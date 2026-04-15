package services

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// PaymentProcessor identifica uma maquininha (adquirente) e suas taxas percentuais
// por parcelamento. A fonte de verdade são as linhas da tabela
// `payment_processors` em Postgres (migration 000016) — este struct é o shape
// com que o Go trabalha em memória após ler do banco ou do fallback local.
type PaymentProcessor struct {
	ID   string             // slug: "infinitepay", "ton", "stone", ...
	Name string             // label visível: "InfinitePay", "Ton", ...
	Fees map[string]float64 // "1x" → 3.5, "2x" → 4.5, ...
}

// fallbackFeeTable é usado quando o Postgres não está disponível (ex: durante
// testes unitários offline ou no primeiro boot antes da migration 000016
// rodar). Precisa ser mantido em paridade com o seed da migration — se você
// alterar a migration, atualize esta tabela também. O teste
// TestFeeTable_CobreTodosProcessadoresDoPWA garante que os slugs batem.
var fallbackFeeTable = map[string]PaymentProcessor{
	"infinitepay": {
		ID:   "infinitepay",
		Name: "InfinitePay",
		Fees: map[string]float64{
			"1x": 3.50, "2x": 4.50, "3x": 5.37, "4x": 6.24, "5x": 7.11, "6x": 7.98,
			"7x": 8.85, "8x": 9.72, "9x": 10.59, "10x": 11.46, "11x": 12.33, "12x": 13.20,
		},
	},
	"ton": {
		ID:   "ton",
		Name: "Ton",
		Fees: map[string]float64{
			"1x": 3.19, "2x": 4.69, "3x": 5.75, "4x": 6.82, "5x": 7.88, "6x": 8.95,
			"7x": 10.01, "8x": 11.08, "9x": 12.14, "10x": 13.21, "11x": 14.27, "12x": 15.34,
		},
	},
	"stone": {
		ID:   "stone",
		Name: "Stone",
		Fees: map[string]float64{
			"1x": 3.29, "2x": 4.59, "3x": 5.89, "4x": 7.19, "5x": 8.49, "6x": 9.79,
			"7x": 11.09, "8x": 12.39, "9x": 13.69, "10x": 14.99, "11x": 16.29, "12x": 17.59,
		},
	},
	"mercadopago": {
		ID:   "mercadopago",
		Name: "Mercado Pago",
		Fees: map[string]float64{
			"1x": 3.49, "2x": 4.89, "3x": 6.29, "4x": 7.69, "5x": 9.09, "6x": 10.49,
			"7x": 11.89, "8x": 13.29, "9x": 14.69, "10x": 16.09, "11x": 17.49, "12x": 18.89,
		},
	},
	"cielo": {
		ID:   "cielo",
		Name: "Cielo",
		Fees: map[string]float64{
			"1x": 3.89, "2x": 5.29, "3x": 6.69, "4x": 8.09, "5x": 9.49, "6x": 10.89,
			"7x": 12.29, "8x": 13.69, "9x": 15.09, "10x": 16.49, "11x": 17.89, "12x": 19.29,
		},
	},
	"pagbank": {
		ID:   "pagbank",
		Name: "PagBank",
		Fees: map[string]float64{
			"1x": 3.39, "2x": 4.79, "3x": 6.19, "4x": 7.59, "5x": 8.99, "6x": 10.39,
			"7x": 11.79, "8x": 13.19, "9x": 14.59, "10x": 15.99, "11x": 17.39, "12x": 18.79,
		},
	},
}

// FeeTable é exposto para testes de paridade (vide rollover_test.go). Em
// produção, use LoadFeeTable() que tenta o Postgres primeiro.
var FeeTable = fallbackFeeTable

// feeCache guarda o último resultado bem-sucedido de LoadFeeTable para evitar
// roundtrip por chamada. TTL padrão = 5 minutos — taxas de adquirente mudam
// raramente e o `updated_at` da tabela pode ser polled se necessário.
var feeCache struct {
	sync.RWMutex
	data   map[string]PaymentProcessor
	loaded time.Time
}

const feeCacheTTL = 5 * time.Minute

// LoadFeeTable retorna o mapa de processadores em memória, priorizando o
// Postgres (tabela payment_processors da migration 000016). Em caso de falha
// de conexão, missing table ou pool nil, retorna o fallbackFeeTable sem erro.
// A invalidação do cache acontece por TTL.
func LoadFeeTable(ctx context.Context) map[string]PaymentProcessor {
	feeCache.RLock()
	if feeCache.data != nil && time.Since(feeCache.loaded) < feeCacheTTL {
		cached := feeCache.data
		feeCache.RUnlock()
		return cached
	}
	feeCache.RUnlock()

	if db.Pool == nil {
		return fallbackFeeTable
	}

	rows, err := db.Pool.Query(ctx,
		`SELECT slug, name, fees FROM payment_processors WHERE active = TRUE`)
	if err != nil {
		return fallbackFeeTable
	}
	defer rows.Close()

	result := make(map[string]PaymentProcessor)
	for rows.Next() {
		var slug, name string
		var feesJSON []byte
		if err := rows.Scan(&slug, &name, &feesJSON); err != nil {
			return fallbackFeeTable
		}
		fees := map[string]float64{}
		if err := json.Unmarshal(feesJSON, &fees); err != nil {
			return fallbackFeeTable
		}
		result[slug] = PaymentProcessor{ID: slug, Name: name, Fees: fees}
	}
	if rows.Err() != nil || len(result) == 0 {
		return fallbackFeeTable
	}

	feeCache.Lock()
	feeCache.data = result
	feeCache.loaded = time.Now()
	feeCache.Unlock()
	return result
}

// InvalidateFeeCache força a próxima LoadFeeTable a reconsultar o banco.
// Útil em testes ou quando um admin atualizar a tabela via UI futura.
func InvalidateFeeCache() {
	feeCache.Lock()
	feeCache.data = nil
	feeCache.loaded = time.Time{}
	feeCache.Unlock()
}

// RolloverOperation representa uma etapa da timeline de saques/pagamentos.
// Estrutura compatível com o que o PWA grava em `debt_rollovers.operations_json`.
type RolloverOperation struct {
	Index     int    `json:"index"`
	Month     int    `json:"month"`
	AmountCts int    `json:"amount_cents"`
	FeeCts    int    `json:"fee_cents"`
	NetCts    int    `json:"net_cents"`
	Note      string `json:"note"`
}

// RolloverSimulation é o resultado do motor do Epic 5.2 num formato estruturado.
type RolloverSimulation struct {
	WorkspaceID      string
	CardID           *string // nullable
	Institution      string
	InstitutionSlug  string
	InvoiceValueCts  int
	Installments     string // "2x", "3x", ...
	FeePercentage    float64
	TotalFeesCts     int
	TotalOperations  int
	Operations       []RolloverOperation
}

// SimulateRollover recebe o valor da fatura em centavos, slug da adquirente e
// parcelamento desejado e devolve uma simulação estruturada pronta para ser
// persistida em `debt_rollovers`. Retorna erro se o processor ou installments
// forem desconhecidos. A tabela de taxas é consultada via LoadFeeTable(), que
// faz cache de 5min sobre a tabela Postgres payment_processors.
func SimulateRollover(workspaceID string, cardID *string, invoiceValueCts int, processorSlug string, installments string) (*RolloverSimulation, error) {
	table := LoadFeeTable(context.Background())
	processor, ok := table[processorSlug]
	if !ok {
		return nil, fmt.Errorf("processador desconhecido: %s", processorSlug)
	}

	feePct, ok := processor.Fees[installments]
	if !ok {
		return nil, fmt.Errorf("parcelamento %s não suportado em %s", installments, processor.Name)
	}

	nParcelas := 0
	if _, err := fmt.Sscanf(installments, "%dx", &nParcelas); err != nil || nParcelas < 1 {
		return nil, fmt.Errorf("installments inválido: %s", installments)
	}

	// Simulação simples: divide o valor da fatura em N saques iguais,
	// cada um pagando a taxa percentual única da adquirente sobre o valor sacado.
	// O PWA faz algo similar — quando quisermos bater bit-a-bit com a timeline rica
	// do front, esta função é o ponto certo para evoluir.
	parcelaCts := int(math.Round(float64(invoiceValueCts) / float64(nParcelas)))
	ops := make([]RolloverOperation, 0, nParcelas)
	totalFeeCts := 0

	for i := 0; i < nParcelas; i++ {
		feeCts := int(math.Round(float64(parcelaCts) * feePct / 100.0))
		netCts := parcelaCts - feeCts
		ops = append(ops, RolloverOperation{
			Index:     i + 1,
			Month:     i + 1,
			AmountCts: parcelaCts,
			FeeCts:    feeCts,
			NetCts:    netCts,
			Note:      fmt.Sprintf("Saque %d/%d via %s", i+1, nParcelas, processor.Name),
		})
		totalFeeCts += feeCts
	}

	return &RolloverSimulation{
		WorkspaceID:     workspaceID,
		CardID:          cardID,
		Institution:     processor.Name,
		InstitutionSlug: processor.ID,
		InvoiceValueCts: invoiceValueCts,
		Installments:    installments,
		FeePercentage:   feePct,
		TotalFeesCts:    totalFeeCts,
		TotalOperations: nParcelas,
		Operations:      ops,
	}, nil
}

// PersistRollover escreve a simulação em `debt_rollovers` (fonte única de
// verdade da feature "Empurrar Fatura", compartilhada com o PWA) e também
// gera transactions futuras em `transactions` para que o fluxo de caixa
// existente no Epic 3/6 continue enxergando os débitos prorrogados.
func PersistRollover(ctx context.Context, sim *RolloverSimulation) error {
	if db.Pool == nil {
		return fmt.Errorf("db pool não inicializado")
	}

	opsJSON, err := json.Marshal(sim.Operations)
	if err != nil {
		return fmt.Errorf("serializando operations_json: %w", err)
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciando transação: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`INSERT INTO debt_rollovers (
			workspace_id, card_id, institution, invoice_value_cents,
			total_fees_cents, total_operations, installments, fee_percentage,
			status, operations_json
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		sim.WorkspaceID, sim.CardID, sim.Institution, sim.InvoiceValueCts,
		sim.TotalFeesCts, sim.TotalOperations, sim.Installments, sim.FeePercentage,
		"concluido", opsJSON,
	)
	if err != nil {
		return fmt.Errorf("insert debt_rollovers: %w", err)
	}

	// Backwards-compat: continua gerando transactions futuras (uma por mês)
	// para que DRE, reports e nudges do Epic 4 enxerguem o impacto mês a mês.
	for _, op := range sim.Operations {
		_, err = tx.Exec(ctx,
			`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
			 VALUES ($1, $2, 'expense', $3, CURRENT_TIMESTAMP + make_interval(days => $4))`,
			sim.WorkspaceID, op.AmountCts, fmt.Sprintf("Rolagem %s %d/%d", sim.Institution, op.Index, sim.TotalOperations), op.Month*30,
		)
		if err != nil {
			return fmt.Errorf("insert transactions futuras: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit rollover: %w", err)
	}
	return nil
}
