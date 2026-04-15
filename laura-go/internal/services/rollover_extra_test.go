package services

import (
	"context"
	"testing"
	"time"
)

// TestRollover_NoTx: SimulateRollover não toca o banco — garante que mesmo
// sem nenhuma transaction pré-existente (pool nil), a simulação calcula ok
// via fallbackFeeTable. Este é o cenário do primeiro rollout antes do seed
// ter rodado.
func TestRollover_NoTx(t *testing.T) {
	InvalidateFeeCache()
	// db.Pool fica nil em testes unitários.
	sim, err := SimulateRollover("ws-notx", nil, 50_000, "infinitepay", "3x")
	if err != nil {
		t.Fatalf("SimulateRollover erro: %v", err)
	}
	if sim == nil {
		t.Fatal("sim é nil")
	}
	if sim.TotalOperations != 3 {
		t.Errorf("TotalOperations=%d esperado 3", sim.TotalOperations)
	}
	if len(sim.Operations) != 3 {
		t.Errorf("len(Operations)=%d esperado 3", len(sim.Operations))
	}
	if sim.WorkspaceID != "ws-notx" {
		t.Errorf("WorkspaceID=%q esperado ws-notx", sim.WorkspaceID)
	}
}

// TestRollover_Surplus: valor da fatura maior que capacity da parcela única.
// Exemplo real: R$ 10_000 dividido em 6x via Stone (9.79%). Garante que
// cada parcela tem amount > 0, fee <= amount (sanity), total_fees consistente.
func TestRollover_Surplus(t *testing.T) {
	InvalidateFeeCache()
	invoice := 1_000_000 // R$ 10.000
	sim, err := SimulateRollover("ws-surplus", nil, invoice, "stone", "6x")
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	parcela := invoice / 6
	for i, op := range sim.Operations {
		if op.AmountCts == 0 {
			t.Errorf("op[%d].AmountCts=0", i)
		}
		if op.FeeCts < 0 || op.FeeCts > op.AmountCts {
			t.Errorf("op[%d].FeeCts=%d inválido (AmountCts=%d)", i, op.FeeCts, op.AmountCts)
		}
		if op.NetCts+op.FeeCts != op.AmountCts {
			t.Errorf("op[%d]: net+fee != amount (%d+%d!=%d)", i, op.NetCts, op.FeeCts, op.AmountCts)
		}
		// Cada parcela deve estar próxima de invoice/6 (tolerância de round).
		diff := op.AmountCts - parcela
		if diff < -1 || diff > 1 {
			t.Errorf("op[%d].AmountCts=%d desviou demais de %d", i, op.AmountCts, parcela)
		}
	}
	if sim.TotalFeesCts <= 0 {
		t.Errorf("TotalFeesCts=%d deveria ser positivo", sim.TotalFeesCts)
	}
}

// TestRollover_MonthBoundary: cada operation deve ter Month = index+1,
// e a distribuição tem que cobrir 1..N sem pulos. Isso valida que a
// timeline mensal, que o cron de fluxo de caixa consome, é densa.
func TestRollover_MonthBoundary(t *testing.T) {
	InvalidateFeeCache()
	sim, err := SimulateRollover("ws-mb", nil, 1_200_00, "mercadopago", "12x")
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	if len(sim.Operations) != 12 {
		t.Fatalf("len=%d esperado 12", len(sim.Operations))
	}
	for i, op := range sim.Operations {
		if op.Month != i+1 {
			t.Errorf("op[%d].Month=%d esperado %d", i, op.Month, i+1)
		}
		if op.Index != i+1 {
			t.Errorf("op[%d].Index=%d esperado %d", i, op.Index, i+1)
		}
		if op.Note == "" {
			t.Errorf("op[%d].Note vazio", i)
		}
	}
}

// TestLoadFeeTable_Cache: duas chamadas consecutivas em pool nil devem
// retornar o fallback consistente — garante que o cache path não corrompe.
func TestLoadFeeTable_Cache(t *testing.T) {
	InvalidateFeeCache()
	t1 := LoadFeeTable(context.Background())
	t2 := LoadFeeTable(context.Background())
	if len(t1) != len(t2) {
		t.Errorf("tamanhos divergem: %d != %d", len(t1), len(t2))
	}
	for slug := range t1 {
		if _, ok := t2[slug]; !ok {
			t.Errorf("slug %q sumiu entre chamadas", slug)
		}
	}
}

// TestInvalidateFeeCache_ResetsLoadedAt: após Invalidate, loaded fica zero
// e próxima LoadFeeTable reconsulta (aqui cai no fallback porque pool=nil).
func TestInvalidateFeeCache_ResetsLoadedAt(t *testing.T) {
	// Preenche cache manualmente para ter algo a invalidar
	feeCache.Lock()
	feeCache.data = map[string]PaymentProcessor{"fake": {ID: "fake"}}
	feeCache.loaded = time.Now()
	feeCache.Unlock()

	InvalidateFeeCache()

	feeCache.RLock()
	defer feeCache.RUnlock()
	if feeCache.data != nil {
		t.Error("feeCache.data deveria ser nil após Invalidate")
	}
	if !feeCache.loaded.IsZero() {
		t.Error("feeCache.loaded deveria ser zero após Invalidate")
	}
}

// TestSimulateRollover_InvoiceZero: fatura zero → todas as parcelas zero.
func TestSimulateRollover_InvoiceZero(t *testing.T) {
	sim, err := SimulateRollover("ws-zero", nil, 0, "infinitepay", "2x")
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	for i, op := range sim.Operations {
		if op.AmountCts != 0 {
			t.Errorf("op[%d].AmountCts=%d esperado 0", i, op.AmountCts)
		}
		if op.FeeCts != 0 {
			t.Errorf("op[%d].FeeCts=%d esperado 0", i, op.FeeCts)
		}
	}
	if sim.TotalFeesCts != 0 {
		t.Errorf("TotalFeesCts=%d esperado 0", sim.TotalFeesCts)
	}
}

// TestSimulateRollover_WithCardID: garante que o ponteiro opcional é propagado.
func TestSimulateRollover_WithCardID(t *testing.T) {
	cardID := "card-uuid-abc"
	sim, err := SimulateRollover("ws", &cardID, 10_000, "ton", "2x")
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	if sim.CardID == nil {
		t.Fatal("CardID nil após passar ponteiro")
	}
	if *sim.CardID != cardID {
		t.Errorf("CardID=%q esperado %q", *sim.CardID, cardID)
	}
}

// TestPersistRollover_NilPool: sem db.Pool, deve retornar erro claro, não panic.
func TestPersistRollover_NilPool(t *testing.T) {
	sim := &RolloverSimulation{
		WorkspaceID:     "ws",
		Institution:     "InfinitePay",
		InstitutionSlug: "infinitepay",
		InvoiceValueCts: 100_000,
		Installments:    "2x",
		Operations: []RolloverOperation{
			{Index: 1, Month: 1, AmountCts: 50_000, FeeCts: 2_250, NetCts: 47_750},
		},
	}
	err := PersistRollover(context.Background(), sim)
	if err == nil {
		t.Fatal("esperava erro por pool nil, veio nil")
	}
}
