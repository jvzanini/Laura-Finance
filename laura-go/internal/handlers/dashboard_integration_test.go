//go:build integration

package handlers_test

import (
	"context"
	"testing"

	"github.com/jvzanini/laura-finance/laura-go/internal/testutil"
)

// TestDash_CashFlow_Empty — sem transações retorna série com pontos zero.
func TestDash_CashFlow_Empty(t *testing.T) {
	dep := testutil.NewTestApp(t)
	status, body := doReq(t, dep, "GET", "/api/v1/dashboard/cashflow", "")
	if status != 200 {
		t.Fatalf("status = %d", status)
	}
	pts, _ := body["points"].([]any)
	// Pode ter de 1 a 31 pontos (dia 1 até hoje), todos zerados.
	if len(pts) == 0 {
		t.Errorf("esperava pelo menos 1 ponto (cashflow sempre preenche série)")
	}
	for _, p := range pts {
		pt := p.(map[string]any)
		if toInt(pt["gastos_cents"]) != 0 || toInt(pt["entradas_cents"]) != 0 {
			t.Errorf("ponto não zerado em workspace vazio: %+v", pt)
		}
	}
}

// TestDash_CashFlow_ComGastos — soma gastos do mês corrente.
func TestDash_CashFlow_ComGastos(t *testing.T) {
	dep := testutil.NewTestApp(t)
	ctx := context.Background()
	_, _ = dep.Pool.Exec(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
		 VALUES ($1, 250000, 'expense', 'Mercado', CURRENT_TIMESTAMP)`,
		dep.WorkspaceID,
	)
	status, body := doReq(t, dep, "GET", "/api/v1/dashboard/cashflow", "")
	if status != 200 {
		t.Fatalf("status = %d", status)
	}
	pts, _ := body["points"].([]any)
	var total int
	for _, p := range pts {
		pt := p.(map[string]any)
		total += toInt(pt["gastos_cents"])
	}
	if total != 250000 {
		t.Errorf("soma gastos = %d, esperado 250000", total)
	}
}

// TestDash_CategoryBudgets_ListaCategoriasComTeto — só categorias com
// monthly_limit_cents > 0 aparecem, em ordem descendente de % usado.
func TestDash_CategoryBudgets_ListaCategoriasComTeto(t *testing.T) {
	dep := testutil.NewTestApp(t)
	ctx := context.Background()
	var catA, catB string
	_ = dep.Pool.QueryRow(ctx,
		`INSERT INTO categories (workspace_id, name, emoji, color, monthly_limit_cents)
		 VALUES ($1, 'Com Teto', '🎯', '#ff0000', 100000) RETURNING id`,
		dep.WorkspaceID,
	).Scan(&catA)
	_ = dep.Pool.QueryRow(ctx,
		`INSERT INTO categories (workspace_id, name, emoji, color, monthly_limit_cents)
		 VALUES ($1, 'Sem Teto', '🪁', '#00ff00', 0) RETURNING id`,
		dep.WorkspaceID,
	).Scan(&catB)
	_ = catB // Não deve aparecer no resultado

	status, body := doReq(t, dep, "GET", "/api/v1/dashboard/category-budgets", "")
	if status != 200 {
		t.Fatalf("status = %d", status)
	}
	cats, _ := body["categories"].([]any)
	if len(cats) != 1 {
		t.Fatalf("esperava 1 categoria com teto, veio %d", len(cats))
	}
	c := cats[0].(map[string]any)
	if c["id"] != catA {
		t.Errorf("esperava categoria %s, veio %v", catA, c["id"])
	}
}
