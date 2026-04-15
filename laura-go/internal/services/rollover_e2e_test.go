package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

// e2eSetup sobe um Postgres descartável via testcontainers, executa todas as
// migrations presentes em infrastructure/migrations/ e devolve uma conexão
// pronta. Retorna também uma função teardown que derruba o container.
//
// Usa uma imagem oficial do postgres (não o pgvector) porque os testes do
// Epic 5 não dependem de embeddings — reduz tempo de pull. Quando testes
// E2E de NLP vetorial forem adicionados, migrar para ankane/pgvector.
func e2eSetup(t *testing.T) (*pgxpool.Pool, func()) {
	t.Helper()

	if os.Getenv("SKIP_E2E") == "1" {
		t.Skip("SKIP_E2E=1 — pulando testes que dependem de Docker")
	}

	ctx := context.Background()

	// ankane/pgvector:latest é a mesma imagem usada em infrastructure/
	// docker-compose.yml. Precisamos dela porque a migration 000001_init
	// faz CREATE EXTENSION vector — usar postgres stock alpine quebra.
	pgContainer, err := tcpostgres.Run(ctx,
		"ankane/pgvector:latest",
		tcpostgres.WithDatabase("laura_test"),
		tcpostgres.WithUsername("laura"),
		tcpostgres.WithPassword("laura_password"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("subir container postgres: %v", err)
	}

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = pgContainer.Terminate(ctx)
		t.Fatalf("obter connection string: %v", err)
	}

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		_ = pgContainer.Terminate(ctx)
		t.Fatalf("abrir pool: %v", err)
	}

	// Aplica todas as migrations em ordem numérica.
	migrationsDir := findMigrationsDir(t)
	applyMigrations(t, ctx, pool, migrationsDir)

	// Conecta o db.Pool global para que SimulateRollover/PersistRollover
	// achem a conexão via db.Pool.
	oldPool := db.Pool
	db.Pool = pool
	InvalidateFeeCache()

	teardown := func() {
		db.Pool = oldPool
		pool.Close()
		if err := pgContainer.Terminate(ctx); err != nil {
			t.Logf("terminate postgres container: %v", err)
		}
	}

	return pool, teardown
}

// findMigrationsDir localiza o diretório laura-go/internal/migrations
// (fonte canônica via go:embed). Os testes rodam a partir de
// laura-go/internal/services, sobe 1 nível até internal/.
func findMigrationsDir(t *testing.T) string {
	t.Helper()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	// internal/services -> internal/migrations
	dir := filepath.Join(cwd, "..", "migrations")
	if _, err := os.Stat(dir); err != nil {
		t.Fatalf("migrations dir %s não encontrado: %v", dir, err)
	}
	return dir
}

// applyMigrations lê todos os .sql do diretório em ordem alfabética
// (que coincide com a ordem numérica 000001..000022) e executa em
// sequência na pool fornecida.
func applyMigrations(t *testing.T, ctx context.Context, pool *pgxpool.Pool, dir string) {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("listar migrations: %v", err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".up.sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, f := range files {
		sqlBytes, err := os.ReadFile(filepath.Join(dir, f))
		if err != nil {
			t.Fatalf("ler %s: %v", f, err)
		}
		if _, err := pool.Exec(ctx, string(sqlBytes)); err != nil {
			t.Fatalf("executar %s: %v", f, err)
		}
	}
}

// seedWorkspaceAndCard cria um workspace + cartão básico no banco de
// teste, retornando os IDs gerados. Usado por cada cenário E2E para
// ter dados mínimos válidos.
func seedWorkspaceAndCard(t *testing.T, ctx context.Context, pool *pgxpool.Pool) (workspaceID, cardID string) {
	t.Helper()
	err := pool.QueryRow(ctx,
		"INSERT INTO workspaces (name) VALUES ('E2E Test Workspace') RETURNING id",
	).Scan(&workspaceID)
	if err != nil {
		t.Fatalf("insert workspace: %v", err)
	}

	err = pool.QueryRow(ctx,
		`INSERT INTO cards (workspace_id, name, brand, closing_day, due_day, last_four, card_type, holder, credit_limit_cents)
		 VALUES ($1, 'Nubank E2E', 'Mastercard', 1, 10, '1234', 'credito', 'Test User', 1000000)
		 RETURNING id`,
		workspaceID,
	).Scan(&cardID)
	if err != nil {
		t.Fatalf("insert card: %v", err)
	}
	return workspaceID, cardID
}

func TestE2E_PersistRollover_CriaDebtRolloverETransactions(t *testing.T) {
	_, teardown := e2eSetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, cardID := seedWorkspaceAndCard(t, ctx, db.Pool)

	// Simula uma rolagem real de R$ 1000 em 2x via InfinitePay.
	sim, err := SimulateRollover(workspaceID, &cardID, 100_000, "infinitepay", "2x")
	if err != nil {
		t.Fatalf("SimulateRollover: %v", err)
	}
	if sim.TotalOperations != 2 {
		t.Fatalf("esperava 2 operações, veio %d", sim.TotalOperations)
	}

	// Persiste
	if err := PersistRollover(ctx, sim); err != nil {
		t.Fatalf("PersistRollover: %v", err)
	}

	// Verifica debt_rollovers (sink canônico)
	var drCount int
	var drTotalFees, drInvoiceValue int
	var drInstitution, drInstallments, drStatus string
	err = db.Pool.QueryRow(ctx,
		`SELECT COUNT(*), MIN(total_fees_cents), MIN(invoice_value_cents),
		        MIN(institution), MIN(installments), MIN(status)
		 FROM debt_rollovers WHERE workspace_id = $1`,
		workspaceID,
	).Scan(&drCount, &drTotalFees, &drInvoiceValue, &drInstitution, &drInstallments, &drStatus)
	if err != nil {
		t.Fatalf("query debt_rollovers: %v", err)
	}
	if drCount != 1 {
		t.Errorf("debt_rollovers count = %d, esperado 1", drCount)
	}
	if drInvoiceValue != 100_000 {
		t.Errorf("invoice_value_cents = %d, esperado 100000", drInvoiceValue)
	}
	if drInstitution != "InfinitePay" {
		t.Errorf("institution = %q, esperado InfinitePay", drInstitution)
	}
	if drInstallments != "2x" {
		t.Errorf("installments = %q, esperado 2x", drInstallments)
	}
	if drStatus != "concluido" {
		t.Errorf("status = %q, esperado concluido", drStatus)
	}
	// InfinitePay 2x = 4.5%, 50k * 0.045 = 2250 por op, 2 ops = 4500
	if drTotalFees != 4_500 {
		t.Errorf("total_fees_cents = %d, esperado 4500", drTotalFees)
	}

	// Verifica que o operations_json foi gravado como JSONB válido
	var opsJSONCount int
	err = db.Pool.QueryRow(ctx,
		`SELECT jsonb_array_length(operations_json) FROM debt_rollovers WHERE workspace_id = $1`,
		workspaceID,
	).Scan(&opsJSONCount)
	if err != nil {
		t.Errorf("jsonb_array_length: %v", err)
	} else if opsJSONCount != 2 {
		t.Errorf("operations_json array length = %d, esperado 2", opsJSONCount)
	}

	// Verifica transactions futuras (sink backwards-compat)
	var txCount int
	var txTotal int
	err = db.Pool.QueryRow(ctx,
		`SELECT COUNT(*), COALESCE(SUM(amount), 0)::int
		 FROM transactions
		 WHERE workspace_id = $1 AND description LIKE 'Rolagem%'`,
		workspaceID,
	).Scan(&txCount, &txTotal)
	if err != nil {
		t.Fatalf("query transactions: %v", err)
	}
	if txCount != 2 {
		t.Errorf("transactions count = %d, esperado 2 (uma por op)", txCount)
	}
	if txTotal != 100_000 {
		// A soma das parcelas = 50k + 50k = 100k (ignora taxas na transaction)
		t.Errorf("soma das transactions = %d, esperado 100000", txTotal)
	}
}

func TestE2E_CrisisContext_FullFlowFromDetectionToPersist(t *testing.T) {
	_, teardown := e2eSetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, _ := seedWorkspaceAndCard(t, ctx, db.Pool)

	phoneNumber := "+5511988881234"

	// Passo 1: detecção de crise → guarda contexto
	ClearAllCrisisContexts()
	SetCrisisContext(&CrisisContext{
		WorkspaceID:     workspaceID,
		PhoneNumber:     phoneNumber,
		InvoiceValueCts: 250_000, // R$ 2500
		ProcessorSlug:   "stone",
		Installments:    "3x",
	})

	// Passo 2: confirmação → recupera contexto
	ctxCrisis := GetCrisisContext(phoneNumber)
	if ctxCrisis == nil {
		t.Fatal("contexto de crise não recuperado após Set")
	}
	if ctxCrisis.InvoiceValueCts != 250_000 {
		t.Errorf("InvoiceValueCts recuperado = %d, esperado 250000", ctxCrisis.InvoiceValueCts)
	}

	// Passo 3: simulação real com valores do contexto
	sim, err := SimulateRollover(ctxCrisis.WorkspaceID, ctxCrisis.CardID, ctxCrisis.InvoiceValueCts, ctxCrisis.ProcessorSlug, ctxCrisis.Installments)
	if err != nil {
		t.Fatalf("SimulateRollover: %v", err)
	}
	if sim.Institution != "Stone" {
		t.Errorf("institution = %s, esperado Stone", sim.Institution)
	}
	if sim.TotalOperations != 3 {
		t.Errorf("ops = %d, esperado 3", sim.TotalOperations)
	}

	// Passo 4: persistência end-to-end
	if err := PersistRollover(ctx, sim); err != nil {
		t.Fatalf("PersistRollover: %v", err)
	}

	// Verifica que gravou no debt_rollovers com os valores da crise
	var savedInvoice, savedFees int
	err = db.Pool.QueryRow(ctx,
		`SELECT invoice_value_cents, total_fees_cents FROM debt_rollovers WHERE workspace_id = $1`,
		workspaceID,
	).Scan(&savedInvoice, &savedFees)
	if err != nil {
		t.Fatalf("query debt_rollovers: %v", err)
	}
	if savedInvoice != 250_000 {
		t.Errorf("invoice_value_cents gravado = %d, esperado 250000", savedInvoice)
	}

	// Stone 3x = 5.89% → ~83333 cents * 3 ops cada, total fees = 83333*0.0589*3
	// Como o código divide 250000/3 e arredonda, cada op vai ter valores
	// ligeiramente diferentes. Não valida o número exato — apenas que o
	// total > 0 e < invoice (sanity check).
	if savedFees <= 0 || savedFees >= 250_000 {
		t.Errorf("total_fees_cents = %d, esperava valor entre 0 e 250000", savedFees)
	}

	// Contexto já foi consumido pelo Get anterior — segunda chamada = nil
	if GetCrisisContext(phoneNumber) != nil {
		t.Error("contexto ainda disponível após consumo — deveria ter sido apagado")
	}
}

func TestE2E_LoadFeeTable_ConsultaPostgresPaymentProcessors(t *testing.T) {
	_, teardown := e2eSetup(t)
	defer teardown()

	ctx := context.Background()

	// A migration 000016 já inseriu os 6 processadores. Verifica via LoadFeeTable.
	table := LoadFeeTable(ctx)
	expected := []string{"infinitepay", "ton", "stone", "mercadopago", "cielo", "pagbank"}
	for _, slug := range expected {
		p, ok := table[slug]
		if !ok {
			t.Errorf("LoadFeeTable: processor %q não encontrado (DB pode não ter rodado a migration 16)", slug)
			continue
		}
		if len(p.Fees) != 12 {
			t.Errorf("processor %q tem %d parcelamentos, esperado 12", slug, len(p.Fees))
		}
	}

	// Invalida cache e confirma que reconsulta sem erro
	InvalidateFeeCache()
	reloaded := LoadFeeTable(ctx)
	if len(reloaded) == 0 {
		t.Error("LoadFeeTable após invalidate retornou mapa vazio")
	}
}

// Smoke check: só para garantir que a infra de tests (imports, fmt) não
// quebra mesmo quando SKIP_E2E=1.
func TestE2E_SmokeImport(t *testing.T) {
	_ = fmt.Sprintf("E2E smoke ok")
}
