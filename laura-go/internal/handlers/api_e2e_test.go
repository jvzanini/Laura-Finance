//go:build e2e
// +build e2e

package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

// apiE2ESetup sobe Postgres, aplica migrations, monta Fiber com os
// handlers e retorna (app, pool, teardown). Compartilha spirit com o
// e2eSetup em services/rollover_e2e_test.go mas vive neste package
// para testar via app.Test() (in-memory HTTP, sem subir porta real).
func apiE2ESetup(t *testing.T) (*fiber.App, *pgxpool.Pool, func()) {
	t.Helper()

	if os.Getenv("SKIP_E2E") == "1" {
		t.Skip("SKIP_E2E=1")
	}

	ctx := context.Background()
	pgContainer, err := tcpostgres.Run(ctx,
		"ankane/pgvector:latest",
		tcpostgres.WithDatabase("laura_api_test"),
		tcpostgres.WithUsername("laura"),
		tcpostgres.WithPassword("laura_password"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("subir postgres: %v", err)
	}

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = pgContainer.Terminate(ctx)
		t.Fatalf("connection string: %v", err)
	}

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		_ = pgContainer.Terminate(ctx)
		t.Fatalf("pool: %v", err)
	}

	// Aplica migrations
	migrationsDir := findMigrationsDirAPI(t)
	applyMigrationsAPI(t, ctx, pool, migrationsDir)

	oldPool := db.Pool
	db.Pool = pool

	app := fiber.New()
	RegisterRoutes(app)

	teardown := func() {
		db.Pool = oldPool
		pool.Close()
		_ = pgContainer.Terminate(ctx)
	}

	return app, pool, teardown
}

func findMigrationsDirAPI(t *testing.T) string {
	t.Helper()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	// internal/handlers -> internal -> laura-go -> repo root
	dir := filepath.Join(cwd, "..", "..", "..", "infrastructure", "migrations")
	if _, err := os.Stat(dir); err != nil {
		t.Fatalf("migrations dir não encontrado: %v", err)
	}
	return dir
}

func applyMigrationsAPI(t *testing.T, ctx context.Context, pool *pgxpool.Pool, dir string) {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ler migrations: %v", err)
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)
	for _, f := range files {
		b, err := os.ReadFile(filepath.Join(dir, f))
		if err != nil {
			t.Fatalf("ler %s: %v", f, err)
		}
		if _, err := pool.Exec(ctx, string(b)); err != nil {
			t.Fatalf("executar %s: %v", f, err)
		}
	}
}

// buildSessionCookie produz um cookie no formato base64payload.base64hmac
// assinado com SESSION_SECRET — mesmo formato que RequireSession espera.
// Delega a assinatura para signSessionCookie (mesmo package) para garantir
// paridade bit-a-bit com a geração em produção.
func buildSessionCookie(userID string) string {
	payload := map[string]interface{}{
		"userId": userID,
		"exp":    time.Now().Add(24 * time.Hour).UnixMilli(),
	}
	raw, _ := json.Marshal(payload)
	return signSessionCookie(raw)
}

// seedAPIWorkspace cria workspace + user (normal ou super admin)
// e retorna seus IDs. Helper compartilhado pelos tests E2E da API.
func seedAPIWorkspace(t *testing.T, ctx context.Context, pool *pgxpool.Pool, superAdmin bool) (workspaceID, userID string) {
	t.Helper()
	err := pool.QueryRow(ctx,
		"INSERT INTO workspaces (name) VALUES ('API E2E Workspace') RETURNING id",
	).Scan(&workspaceID)
	if err != nil {
		t.Fatalf("insert workspace: %v", err)
	}
	err = pool.QueryRow(ctx,
		`INSERT INTO users (workspace_id, name, email, password_hash, role, is_super_admin)
		 VALUES ($1, 'Test User', 'test@api.e2e', 'hash', 'proprietário', $2)
		 RETURNING id`,
		workspaceID, superAdmin,
	).Scan(&userID)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	return workspaceID, userID
}

// performRequest executa um request contra o app in-memory e devolve
// status + body decodificado como map. Simplifica assertions.
func performRequest(t *testing.T, app *fiber.App, method, path, cookie string) (int, map[string]interface{}) {
	t.Helper()
	req, _ := http.NewRequest(method, path, nil)
	if cookie != "" {
		req.AddCookie(&http.Cookie{Name: SessionCookieName, Value: cookie})
	}
	resp, err := app.Test(req, 10000)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	result := make(map[string]interface{})
	_ = json.Unmarshal(body, &result)
	return resp.StatusCode, result
}

// performJSONRequest executa um request com body JSON (POST/PUT) e
// retorna status + body decodificado. Usado para endpoints de escrita.
func performJSONRequest(t *testing.T, app *fiber.App, method, path, cookie string, body interface{}) (int, map[string]interface{}) {
	t.Helper()
	raw, _ := json.Marshal(body)
	req, _ := http.NewRequest(method, path, strings.NewReader(string(raw)))
	req.Header.Set("Content-Type", "application/json")
	if cookie != "" {
		req.AddCookie(&http.Cookie{Name: SessionCookieName, Value: cookie})
	}
	resp, err := app.Test(req, 10000)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	respBody, _ := io.ReadAll(resp.Body)
	result := make(map[string]interface{})
	_ = json.Unmarshal(respBody, &result)
	return resp.StatusCode, result
}

func TestAPIE2E_Health_SemSessao(t *testing.T) {
	app, _, teardown := apiE2ESetup(t)
	defer teardown()

	status, body := performRequest(t, app, "GET", "/api/v1/health", "")
	if status != 200 {
		t.Errorf("health: status = %d, esperado 200", status)
	}
	if body["status"] != "ok" {
		t.Errorf("health: status field = %v", body["status"])
	}
}

func TestAPIE2E_Me_SemCookie_Retorna401(t *testing.T) {
	app, _, teardown := apiE2ESetup(t)
	defer teardown()

	status, _ := performRequest(t, app, "GET", "/api/v1/me", "")
	if status != 401 {
		t.Errorf("me sem cookie: status = %d, esperado 401", status)
	}
}

func TestAPIE2E_Me_ComCookieValido_RetornaPerfil(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	_, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	status, body := performRequest(t, app, "GET", "/api/v1/me", cookie)
	if status != 200 {
		t.Errorf("me: status = %d, esperado 200", status)
	}
	if body["email"] != "test@api.e2e" {
		t.Errorf("me.email = %v, esperado test@api.e2e", body["email"])
	}
	if body["name"] != "Test User" {
		t.Errorf("me.name = %v", body["name"])
	}
	if body["role"] != "proprietário" {
		t.Errorf("me.role = %v", body["role"])
	}
}

func TestAPIE2E_DRE_SemTransacoes_Retorna0(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	_, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	status, body := performRequest(t, app, "GET", "/api/v1/reports/dre", cookie)
	if status != 200 {
		t.Errorf("dre: status = %d, esperado 200", status)
	}
	if toInt(body["total_income_cents"]) != 0 {
		t.Errorf("income_cents = %v, esperado 0", body["total_income_cents"])
	}
	if toInt(body["total_expense_cents"]) != 0 {
		t.Errorf("expense_cents = %v, esperado 0", body["total_expense_cents"])
	}
}

func TestAPIE2E_DRE_ComTransacoes_AgregaCorretamente(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	// Seed: uma receita + duas despesas no mês corrente
	_, _ = pool.Exec(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
		 VALUES ($1, 500000, 'income', 'Salário', CURRENT_TIMESTAMP)`,
		workspaceID,
	)
	_, _ = pool.Exec(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
		 VALUES ($1, 150000, 'expense', 'Mercado', CURRENT_TIMESTAMP)`,
		workspaceID,
	)
	_, _ = pool.Exec(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
		 VALUES ($1, 50000, 'expense', 'Uber', CURRENT_TIMESTAMP)`,
		workspaceID,
	)

	status, body := performRequest(t, app, "GET", "/api/v1/reports/dre", cookie)
	if status != 200 {
		t.Errorf("dre: status = %d", status)
	}
	if toInt(body["total_income_cents"]) != 500000 {
		t.Errorf("income_cents = %v, esperado 500000", body["total_income_cents"])
	}
	if toInt(body["total_expense_cents"]) != 200000 {
		t.Errorf("expense_cents = %v, esperado 200000", body["total_expense_cents"])
	}
	if toInt(body["net_result_cents"]) != 300000 {
		t.Errorf("net_result_cents = %v, esperado 300000", body["net_result_cents"])
	}
}

func TestAPIE2E_AdminOverview_NaoAdmin_Retorna403(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	_, userID := seedAPIWorkspace(t, ctx, pool, false) // superAdmin=false
	cookie := buildSessionCookie(userID)

	status, _ := performRequest(t, app, "GET", "/api/v1/admin/overview", cookie)
	if status != 403 {
		t.Errorf("admin overview non-admin: status = %d, esperado 403", status)
	}
}

func TestAPIE2E_AdminOverview_SuperAdmin_RetornaAgregados(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	_, userID := seedAPIWorkspace(t, ctx, pool, true) // superAdmin=true
	cookie := buildSessionCookie(userID)

	status, body := performRequest(t, app, "GET", "/api/v1/admin/overview", cookie)
	if status != 200 {
		t.Errorf("admin overview: status = %d, esperado 200", status)
	}
	// Workspace criado no seed + o workspace criado pela migration
	// (se tiver). No mínimo 1.
	if toInt(body["total_workspaces"]) < 1 {
		t.Errorf("total_workspaces = %v, esperado >= 1", body["total_workspaces"])
	}
	if toInt(body["total_users"]) < 1 {
		t.Errorf("total_users = %v, esperado >= 1", body["total_users"])
	}
}

func toInt(v interface{}) int {
	if v == nil {
		return 0
	}
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case int64:
		return int(n)
	default:
		return 0
	}
}

func TestAPIE2E_Goals_SemSessao_Retorna401(t *testing.T) {
	app, _, teardown := apiE2ESetup(t)
	defer teardown()

	status, _ := performRequest(t, app, "GET", "/api/v1/goals", "")
	if status != 401 {
		t.Errorf("goals sem cookie: status = %d, esperado 401", status)
	}
}

func TestAPIE2E_Goals_VazioRetornaArrayOuNil(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	_, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	status, body := performRequest(t, app, "GET", "/api/v1/goals", cookie)
	if status != 200 {
		t.Errorf("goals: status = %d", status)
	}
	raw, ok := body["goals"]
	if !ok {
		t.Errorf("goals: campo 'goals' ausente no body = %+v", body)
	}
	if raw != nil {
		if arr, isArr := raw.([]interface{}); isArr && len(arr) != 0 {
			t.Errorf("goals: array deveria estar vazio, veio %d items", len(arr))
		}
	}
}

func TestAPIE2E_Goals_ComSeed_RetornaLista(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	_, _ = pool.Exec(ctx,
		`INSERT INTO financial_goals (workspace_id, name, emoji, target_cents, current_cents, deadline, color, status)
		 VALUES ($1, 'Viagem SP', '✈️', 500000, 100000, '2026-12-31', '#8B5CF6', 'active')`,
		workspaceID,
	)
	_, _ = pool.Exec(ctx,
		`INSERT INTO financial_goals (workspace_id, name, emoji, target_cents, current_cents, deadline, color, status)
		 VALUES ($1, 'Fundo Emergência', '🛡️', 1500000, 300000, '2027-06-30', '#10B981', 'active')`,
		workspaceID,
	)

	status, body := performRequest(t, app, "GET", "/api/v1/goals", cookie)
	if status != 200 {
		t.Errorf("goals: status = %d", status)
	}
	goalsRaw, ok := body["goals"].([]interface{})
	if !ok {
		t.Fatalf("goals array ausente: %+v", body)
	}
	if len(goalsRaw) != 2 {
		t.Errorf("esperava 2 goals, veio %d", len(goalsRaw))
	}
}

func TestAPIE2E_Investments_ComSeed_RetornaSummary(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	_, _ = pool.Exec(ctx,
		`INSERT INTO investments (workspace_id, name, broker, type, invested_cents, current_cents, monthly_contribution_cents, emoji)
		 VALUES ($1, 'Nubank CDI', 'Nu Invest', 'Investimentos', 500000, 520000, 20000, '🏦')`,
		workspaceID,
	)
	_, _ = pool.Exec(ctx,
		`INSERT INTO investments (workspace_id, name, broker, type, invested_cents, current_cents, monthly_contribution_cents, emoji)
		 VALUES ($1, 'BTC', 'Binance', 'Cripto', 200000, 260000, 10000, '₿')`,
		workspaceID,
	)

	status, body := performRequest(t, app, "GET", "/api/v1/investments", cookie)
	if status != 200 {
		t.Errorf("investments: status = %d", status)
	}
	if toInt(body["total_invested_cents"]) != 700000 {
		t.Errorf("total_invested = %v, esperado 700000", body["total_invested_cents"])
	}
	if toInt(body["total_current_cents"]) != 780000 {
		t.Errorf("total_current = %v, esperado 780000", body["total_current_cents"])
	}
	if toInt(body["total_monthly_contribution_cents"]) != 30000 {
		t.Errorf("total_monthly = %v, esperado 30000", body["total_monthly_contribution_cents"])
	}
}

func TestAPIE2E_Transactions_ComPaginacao(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	// Seed 5 transações
	for i := 0; i < 5; i++ {
		_, _ = pool.Exec(ctx,
			`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
			 VALUES ($1, $2, 'expense', $3, CURRENT_TIMESTAMP)`,
			workspaceID, 10000*(i+1), "Transação "+strconv.Itoa(i+1),
		)
	}

	status, body := performRequest(t, app, "GET", "/api/v1/transactions", cookie)
	if status != 200 {
		t.Errorf("transactions: status = %d", status)
	}
	txs, ok := body["transactions"].([]interface{})
	if !ok {
		t.Fatalf("transactions array ausente: %+v", body)
	}
	if len(txs) != 5 {
		t.Errorf("esperava 5 transações, veio %d", len(txs))
	}
	if toInt(body["total_count"]) != 5 {
		t.Errorf("total_count = %v, esperado 5", body["total_count"])
	}

	status, body = performRequest(t, app, "GET", "/api/v1/transactions?limit=2", cookie)
	if status != 200 {
		t.Errorf("transactions limit=2: status = %d", status)
	}
	txs, _ = body["transactions"].([]interface{})
	if len(txs) != 2 {
		t.Errorf("limit=2: esperava 2, veio %d", len(txs))
	}
	if toInt(body["total_count"]) != 5 {
		t.Errorf("total_count com limit = %v, esperado 5", body["total_count"])
	}
}

func TestAPIE2E_Cards_ComSeed(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	_, _ = pool.Exec(ctx,
		`INSERT INTO cards (workspace_id, name, brand, color, closing_day, due_day, last_four, card_type, credit_limit_cents)
		 VALUES ($1, 'Nubank Principal', 'Mastercard', '#8B5CF6', 5, 15, '1234', 'credito', 500000)`,
		workspaceID,
	)
	_, _ = pool.Exec(ctx,
		`INSERT INTO cards (workspace_id, name, brand, color, closing_day, due_day, last_four, card_type, credit_limit_cents)
		 VALUES ($1, 'Inter Débito', 'Visa', '#F97316', 0, 0, '5678', 'debito', 0)`,
		workspaceID,
	)

	status, body := performRequest(t, app, "GET", "/api/v1/cards", cookie)
	if status != 200 {
		t.Errorf("cards: status = %d", status)
	}
	cards, _ := body["cards"].([]interface{})
	if len(cards) != 2 {
		t.Errorf("esperava 2 cards, veio %d", len(cards))
	}
}

func TestAPIE2E_Categories_ComArvore(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	var catID string
	err := pool.QueryRow(ctx,
		`INSERT INTO categories (workspace_id, name, emoji, color, description, monthly_limit_cents)
		 VALUES ($1, 'Alimentação', '🍽', '#10B981', 'Gastos com comida', 200000)
		 RETURNING id`,
		workspaceID,
	).Scan(&catID)
	if err != nil {
		t.Fatalf("insert categoria: %v", err)
	}
	_, _ = pool.Exec(ctx,
		`INSERT INTO subcategories (workspace_id, category_id, name, emoji, description)
		 VALUES ($1, $2, 'Supermercado', '🛒', 'Compras de casa')`,
		workspaceID, catID,
	)
	_, _ = pool.Exec(ctx,
		`INSERT INTO subcategories (workspace_id, category_id, name, emoji, description)
		 VALUES ($1, $2, 'Restaurante', '🍕', 'Refeições fora')`,
		workspaceID, catID,
	)

	status, body := performRequest(t, app, "GET", "/api/v1/categories", cookie)
	if status != 200 {
		t.Errorf("categories: status = %d", status)
	}
	cats, _ := body["categories"].([]interface{})
	if len(cats) != 1 {
		t.Fatalf("esperava 1 categoria, veio %d", len(cats))
	}
	cat := cats[0].(map[string]interface{})
	subs, _ := cat["subcategories"].([]interface{})
	if len(subs) != 2 {
		t.Errorf("esperava 2 subcategorias aninhadas, veio %d", len(subs))
	}
}

func TestAPIE2E_Dashboard_Cashflow_ComTransacoes(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	_, _ = pool.Exec(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
		 VALUES ($1, 500000, 'income', 'Salário', CURRENT_TIMESTAMP)`,
		workspaceID,
	)
	_, _ = pool.Exec(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
		 VALUES ($1, 80000, 'expense', 'Mercado', CURRENT_TIMESTAMP)`,
		workspaceID,
	)

	status, body := performRequest(t, app, "GET", "/api/v1/dashboard/cashflow", cookie)
	if status != 200 {
		t.Errorf("cashflow: status = %d", status)
	}
	points, ok := body["points"].([]interface{})
	if !ok || len(points) == 0 {
		t.Fatalf("points ausente ou vazio: %+v", body)
	}
	// Pelo menos um ponto deve ter valores > 0 (hoje).
	found := false
	for _, p := range points {
		pt := p.(map[string]interface{})
		if toInt(pt["gastos_cents"]) > 0 || toInt(pt["entradas_cents"]) > 0 {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("esperava pelo menos 1 ponto com valor > 0")
	}
}

func TestAPIE2E_Dashboard_UpcomingBills_ComInvoices(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	var cardID string
	_ = pool.QueryRow(ctx,
		`INSERT INTO cards (workspace_id, name, color, closing_day, due_day, card_type, credit_limit_cents)
		 VALUES ($1, 'Test Card', '#8B5CF6', 1, 10, 'credito', 500000)
		 RETURNING id`,
		workspaceID,
	).Scan(&cardID)

	// Invoice vencendo em 5 dias, não paga
	_, _ = pool.Exec(ctx,
		`INSERT INTO invoices (workspace_id, card_id, month_ref, total_cents, due_date)
		 VALUES ($1, $2, DATE_TRUNC('month', CURRENT_DATE)::date, 285000, CURRENT_DATE + INTERVAL '5 days')`,
		workspaceID, cardID,
	)

	status, body := performRequest(t, app, "GET", "/api/v1/dashboard/upcoming-bills", cookie)
	if status != 200 {
		t.Errorf("upcoming-bills: status = %d", status)
	}
	bills, _ := body["bills"].([]interface{})
	if len(bills) != 1 {
		t.Errorf("esperava 1 bill, veio %d", len(bills))
	}
}

func TestAPIE2E_Invoices_ComStatusDerivado(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	var cardID string
	_ = pool.QueryRow(ctx,
		`INSERT INTO cards (workspace_id, name, color, closing_day, due_day, card_type, credit_limit_cents)
		 VALUES ($1, 'Test', '#8B5CF6', 1, 10, 'credito', 500000) RETURNING id`,
		workspaceID,
	).Scan(&cardID)

	// Paga
	_, _ = pool.Exec(ctx,
		`INSERT INTO invoices (workspace_id, card_id, month_ref, total_cents, due_date, paid_at)
		 VALUES ($1, $2, '2026-03-01', 100000, '2026-03-15', NOW())`,
		workspaceID, cardID,
	)
	// Atrasada
	_, _ = pool.Exec(ctx,
		`INSERT INTO invoices (workspace_id, card_id, month_ref, total_cents, due_date)
		 VALUES ($1, $2, '2025-12-01', 200000, '2025-12-15')`,
		workspaceID, cardID,
	)
	// Aberta
	_, _ = pool.Exec(ctx,
		`INSERT INTO invoices (workspace_id, card_id, month_ref, total_cents, due_date)
		 VALUES ($1, $2, DATE_TRUNC('month', CURRENT_DATE)::date, 300000, CURRENT_DATE + INTERVAL '10 days')`,
		workspaceID, cardID,
	)

	status, body := performRequest(t, app, "GET", "/api/v1/invoices", cookie)
	if status != 200 {
		t.Errorf("invoices: status = %d", status)
	}
	invs, _ := body["invoices"].([]interface{})
	if len(invs) != 3 {
		t.Fatalf("esperava 3 invoices, veio %d", len(invs))
	}
	// Conta status diferentes
	statusSet := map[string]bool{}
	for _, raw := range invs {
		inv := raw.(map[string]interface{})
		statusSet[inv["status"].(string)] = true
	}
	for _, s := range []string{"paid", "overdue", "open"} {
		if !statusSet[s] {
			t.Errorf("esperava status %q no resultado", s)
		}
	}
}

func TestAPIE2E_DebtRollovers_ComSeed(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	var cardID string
	_ = pool.QueryRow(ctx,
		`INSERT INTO cards (workspace_id, name, color, closing_day, due_day, card_type, credit_limit_cents)
		 VALUES ($1, 'Card', '#fff', 1, 10, 'credito', 500000) RETURNING id`,
		workspaceID,
	).Scan(&cardID)

	_, _ = pool.Exec(ctx,
		`INSERT INTO debt_rollovers (workspace_id, card_id, institution, invoice_value_cents, total_fees_cents, total_operations, installments, fee_percentage, operations_json)
		 VALUES ($1, $2, 'InfinitePay', 100000, 4500, 2, '2x', 4.5, '[]'::jsonb)`,
		workspaceID, cardID,
	)

	status, body := performRequest(t, app, "GET", "/api/v1/debt-rollovers", cookie)
	if status != 200 {
		t.Errorf("debt-rollovers: status = %d", status)
	}
	rs, _ := body["rollovers"].([]interface{})
	if len(rs) != 1 {
		t.Errorf("esperava 1 rollover, veio %d", len(rs))
	}
}

func TestAPIE2E_Score_Current_RetornaFallbackSemDados(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	_, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	status, body := performRequest(t, app, "GET", "/api/v1/score/current", cookie)
	if status != 200 {
		t.Errorf("score/current: status = %d", status)
	}
	// Sem dados, usa fallback (85/72/65/55) e score ~72
	if toInt(body["score"]) == 0 {
		t.Errorf("score = 0, esperava fallback não-zero")
	}
}

func TestAPIE2E_Score_History_VazioRetornaArray(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	_, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	status, body := performRequest(t, app, "GET", "/api/v1/score/history", cookie)
	if status != 200 {
		t.Errorf("score/history: status = %d", status)
	}
	if _, ok := body["history"]; !ok {
		t.Error("history ausente no body")
	}
}

func TestAPIE2E_Members_ComSeed(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	_, _ = pool.Exec(ctx,
		`INSERT INTO phones (workspace_id, name, phone_number, role)
		 VALUES ($1, 'Maria', '5511988888888', 'membro')`,
		workspaceID,
	)

	status, body := performRequest(t, app, "GET", "/api/v1/members", cookie)
	if status != 200 {
		t.Errorf("members: status = %d", status)
	}
	members, _ := body["members"].([]interface{})
	if len(members) != 1 {
		t.Errorf("esperava 1 member, veio %d", len(members))
	}
}

func TestAPIE2E_CreateGoal_Valido(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	_, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	status, body := performJSONRequest(t, app, "POST", "/api/v1/goals", cookie, map[string]interface{}{
		"name":         "Viagem SP",
		"emoji":        "✈️",
		"target_cents": 500000,
		"color":        "#8B5CF6",
	})
	if status != 201 {
		t.Errorf("POST /goals: status = %d, esperado 201", status)
	}
	if body["success"] != true {
		t.Errorf("success = %v, esperado true", body["success"])
	}
	if body["id"] == nil || body["id"] == "" {
		t.Error("id vazio no response")
	}

	// Validação: retornar erro se target_cents <= 0
	status, _ = performJSONRequest(t, app, "POST", "/api/v1/goals", cookie, map[string]interface{}{
		"name":         "Invalid",
		"target_cents": 0,
	})
	if status != 400 {
		t.Errorf("POST /goals target=0: status = %d, esperado 400", status)
	}
}

func TestAPIE2E_CreateInvestment_Valido(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	_, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	status, body := performJSONRequest(t, app, "POST", "/api/v1/investments", cookie, map[string]interface{}{
		"name":                       "Nubank CDI",
		"broker":                     "Nu Invest",
		"type":                       "Investimentos",
		"invested_cents":             500000,
		"monthly_contribution_cents": 20000,
	})
	if status != 201 {
		t.Errorf("POST /investments: status = %d", status)
	}
	if body["success"] != true {
		t.Errorf("success = %v", body["success"])
	}
}

func TestAPIE2E_CreateCard_Valido(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	_, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	status, body := performJSONRequest(t, app, "POST", "/api/v1/cards", cookie, map[string]interface{}{
		"name":               "Nubank Platinum",
		"brand":              "Mastercard",
		"color":              "#8B5CF6",
		"closing_day":        5,
		"due_day":            15,
		"last_four":          "1234",
		"card_type":          "credito",
		"credit_limit_cents": 1000000,
	})
	if status != 201 {
		t.Errorf("POST /cards: status = %d", status)
	}
	if body["success"] != true {
		t.Errorf("success = %v", body["success"])
	}
}

func TestAPIE2E_ReportsExtras_AllRespond200(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	// Seed básico pra cada aba ter algum dado
	_, _ = pool.Exec(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date, tags)
		 VALUES ($1, 500000, 'income', 'Salário', CURRENT_TIMESTAMP, '{}')`,
		workspaceID,
	)
	_, _ = pool.Exec(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date, tags)
		 VALUES ($1, 150000, 'expense', 'Mercado', CURRENT_TIMESTAMP, ARRAY['viagem-sp'])`,
		workspaceID,
	)

	endpoints := []string{
		"/api/v1/reports/categories",
		"/api/v1/reports/subcategories",
		"/api/v1/reports/cards",
		"/api/v1/reports/payment-methods",
		"/api/v1/reports/travel",
		"/api/v1/reports/comparative",
		"/api/v1/reports/trend",
		"/api/v1/reports/members",
	}
	for _, ep := range endpoints {
		status, body := performRequest(t, app, "GET", ep, cookie)
		if status != 200 {
			t.Errorf("%s: status = %d, esperado 200", ep, status)
		}
		if len(body) == 0 {
			t.Errorf("%s: body vazio", ep)
		}
	}
}

func TestAPIE2E_PaymentProcessors_Retorna6(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	_, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	// Invalidate cache pois o TestE2E_LoadFeeTable anterior pode ter deixado o
	// fallbackFeeTable cacheado em vez da tabela do Postgres fresh.
	services.InvalidateFeeCache()

	status, body := performRequest(t, app, "GET", "/api/v1/payment-processors", cookie)
	if status != 200 {
		t.Errorf("payment-processors: status = %d", status)
	}
	items, _ := body["processors"].([]interface{})
	if len(items) != 6 {
		t.Errorf("esperava 6 processors, veio %d", len(items))
	}
}

func TestAPIE2E_Dashboard_CategoryBudgets_Ordenado(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()

	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	var catA, catB string
	_ = pool.QueryRow(ctx,
		`INSERT INTO categories (workspace_id, name, color, monthly_limit_cents)
		 VALUES ($1, 'Lazer', '#EC4899', 100000) RETURNING id`,
		workspaceID,
	).Scan(&catA)
	_ = pool.QueryRow(ctx,
		`INSERT INTO categories (workspace_id, name, color, monthly_limit_cents)
		 VALUES ($1, 'Mercado', '#10B981', 200000) RETURNING id`,
		workspaceID,
	).Scan(&catB)

	// catA 90% gasto, catB 10% — catA deve vir primeiro
	_, _ = pool.Exec(ctx,
		`INSERT INTO transactions (workspace_id, category_id, amount, type, description, transaction_date)
		 VALUES ($1, $2, 90000, 'expense', 'Jogo', CURRENT_TIMESTAMP)`,
		workspaceID, catA,
	)
	_, _ = pool.Exec(ctx,
		`INSERT INTO transactions (workspace_id, category_id, amount, type, description, transaction_date)
		 VALUES ($1, $2, 20000, 'expense', 'Feira', CURRENT_TIMESTAMP)`,
		workspaceID, catB,
	)

	status, body := performRequest(t, app, "GET", "/api/v1/dashboard/category-budgets", cookie)
	if status != 200 {
		t.Errorf("category-budgets: status = %d", status)
	}
	cats, _ := body["categories"].([]interface{})
	if len(cats) != 2 {
		t.Fatalf("esperava 2 categorias, veio %d", len(cats))
	}
	// Primeira deve ser Lazer (maior % de uso)
	first := cats[0].(map[string]interface{})
	if first["name"] != "Lazer" {
		t.Errorf("esperava Lazer primeiro (maior %%), veio %v", first["name"])
	}
}

func TestAPIE2E_CreateCategory_Valido(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()
	_, userID := seedAPIWorkspace(t, context.Background(), pool, false)
	cookie := buildSessionCookie(userID)

	status, body := performJSONRequest(t, app, "POST", "/api/v1/categories", cookie, map[string]interface{}{
		"name": "Transporte", "emoji": "🚗", "color": "#3B82F6", "monthly_limit_cents": 50000,
	})
	if status != 201 {
		t.Fatalf("status = %d, body = %v", status, body)
	}
	if body["success"] != true {
		t.Errorf("esperava success=true, veio %v", body["success"])
	}
}

func TestAPIE2E_CreateMember_E_Delete(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()
	_, userID := seedAPIWorkspace(t, context.Background(), pool, false)
	cookie := buildSessionCookie(userID)

	status, body := performJSONRequest(t, app, "POST", "/api/v1/members", cookie, map[string]interface{}{
		"name": "Maria", "phone_number": "5511999887766", "role": "membro",
	})
	if status != 201 {
		t.Fatalf("create member: status = %d, body = %v", status, body)
	}
	memberID, _ := body["id"].(string)
	if memberID == "" {
		t.Fatal("member ID vazio")
	}

	delStatus, _ := performJSONRequest(t, app, "DELETE", "/api/v1/members/"+memberID, cookie, nil)
	if delStatus != 200 {
		t.Errorf("delete member: status = %d", delStatus)
	}
}

func TestAPIE2E_DeleteCard(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()
	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	var cardID string
	_ = pool.QueryRow(ctx,
		`INSERT INTO cards (workspace_id, name, color) VALUES ($1, 'Teste', '#000') RETURNING id`,
		workspaceID,
	).Scan(&cardID)

	delStatus, _ := performJSONRequest(t, app, "DELETE", "/api/v1/cards/"+cardID, cookie, nil)
	if delStatus != 200 {
		t.Errorf("delete card: status = %d", delStatus)
	}
}

func TestAPIE2E_DeleteTransaction(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()
	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	var txID string
	_ = pool.QueryRow(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
		 VALUES ($1, 5000, 'expense', 'Teste', CURRENT_TIMESTAMP) RETURNING id`,
		workspaceID,
	).Scan(&txID)

	delStatus, _ := performJSONRequest(t, app, "DELETE", "/api/v1/transactions/"+txID, cookie, nil)
	if delStatus != 200 {
		t.Errorf("delete transaction: status = %d", delStatus)
	}
}

func TestAPIE2E_UpdateTransactionCategory(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()
	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	var catID, txID string
	_ = pool.QueryRow(ctx,
		`INSERT INTO categories (workspace_id, name, color) VALUES ($1, 'Food', '#F00') RETURNING id`,
		workspaceID,
	).Scan(&catID)
	_ = pool.QueryRow(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date, needs_review)
		 VALUES ($1, 3000, 'expense', 'Almoço', CURRENT_TIMESTAMP, true) RETURNING id`,
		workspaceID,
	).Scan(&txID)

	status, _ := performJSONRequest(t, app, "PUT", "/api/v1/transactions/"+txID+"/category", cookie, map[string]interface{}{
		"category_id": catID,
	})
	if status != 200 {
		t.Errorf("update tx category: status = %d", status)
	}
}

func TestAPIE2E_CreateInvoice_E_MarkPaid(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()
	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	var cardID string
	_ = pool.QueryRow(ctx,
		`INSERT INTO cards (workspace_id, name, color) VALUES ($1, 'Nubank', '#8B5CF6') RETURNING id`,
		workspaceID,
	).Scan(&cardID)

	status, _ := performJSONRequest(t, app, "POST", "/api/v1/invoices", cookie, map[string]interface{}{
		"card_id": cardID, "month_ref": "2026-04", "total_cents": 150000, "due_date": "2026-04-15",
	})
	if status != 201 {
		t.Fatalf("create invoice: status = %d", status)
	}

	var invID string
	_ = pool.QueryRow(ctx, "SELECT id FROM invoices WHERE workspace_id = $1 AND card_id = $2", workspaceID, cardID).Scan(&invID)

	payStatus, _ := performJSONRequest(t, app, "POST", "/api/v1/invoices/"+invID+"/pay", cookie, nil)
	if payStatus != 200 {
		t.Errorf("mark paid: status = %d", payStatus)
	}
}

func TestAPIE2E_CreateDebtRollover(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()
	ctx := context.Background()
	workspaceID, userID := seedAPIWorkspace(t, ctx, pool, false)
	cookie := buildSessionCookie(userID)

	var cardID string
	_ = pool.QueryRow(ctx,
		`INSERT INTO cards (workspace_id, name, color) VALUES ($1, 'Itaú', '#F97316') RETURNING id`,
		workspaceID,
	).Scan(&cardID)

	status, body := performJSONRequest(t, app, "POST", "/api/v1/debt-rollovers", cookie, map[string]interface{}{
		"card_id": cardID, "institution": "InfinitePay", "invoice_value_cents": 200000,
		"total_fees_cents": 15000, "total_operations": 3, "installments": "3x",
		"fee_percentage": 7.5, "operations_json": "[]",
	})
	if status != 201 {
		t.Fatalf("create rollover: status = %d, body = %v", status, body)
	}
	if body["success"] != true {
		t.Errorf("esperava success=true")
	}
}

func TestAPIE2E_UpdateProfile(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()
	_, userID := seedAPIWorkspace(t, context.Background(), pool, false)
	cookie := buildSessionCookie(userID)

	status, _ := performJSONRequest(t, app, "PUT", "/api/v1/me/profile", cookie, map[string]interface{}{
		"name": "João Updated", "email": "joao@test.com", "phone_number": "5511999000000",
	})
	if status != 200 {
		t.Errorf("update profile: status = %d", status)
	}
}

func TestAPIE2E_UpdateSettings(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()
	_, userID := seedAPIWorkspace(t, context.Background(), pool, false)
	cookie := buildSessionCookie(userID)

	status, _ := performJSONRequest(t, app, "PUT", "/api/v1/me/settings", cookie, map[string]interface{}{
		"settings": map[string]interface{}{"darkMode": true, "notifications": false},
	})
	if status != 200 {
		t.Errorf("update settings: status = %d", status)
	}
}

func TestAPIE2E_SeedCategories(t *testing.T) {
	app, pool, teardown := apiE2ESetup(t)
	defer teardown()
	_, userID := seedAPIWorkspace(t, context.Background(), pool, false)
	cookie := buildSessionCookie(userID)

	payload := map[string]interface{}{
		"categories": []map[string]interface{}{
			{
				"name": "Alimentação", "emoji": "🍔", "color": "#EF4444",
				"subcategories": []map[string]interface{}{
					{"name": "Restaurantes", "emoji": "🍽️", "description": "Almoço e jantar fora"},
					{"name": "Mercado", "emoji": "🛒", "description": "Compras de supermercado"},
				},
			},
			{
				"name": "Transporte", "emoji": "🚗", "color": "#3B82F6",
				"subcategories": []map[string]interface{}{
					{"name": "Combustível", "emoji": "⛽"},
				},
			},
		},
	}

	status, body := performJSONRequest(t, app, "POST", "/api/v1/categories/seed", cookie, payload)
	if status != 201 {
		t.Fatalf("seed categories: status = %d, body = %v", status, body)
	}

	listStatus, listBody := performRequest(t, app, "GET", "/api/v1/categories", cookie)
	if listStatus != 200 {
		t.Fatalf("list categories: status = %d", listStatus)
	}
	cats, _ := listBody["categories"].([]interface{})
	if len(cats) < 2 {
		t.Errorf("esperava >= 2 categorias seeded, veio %d", len(cats))
	}
	first := cats[0].(map[string]interface{})
	subs, _ := first["subcategories"].([]interface{})
	if len(subs) == 0 {
		t.Errorf("esperava subcategorias seeded na primeira categoria")
	}
}
