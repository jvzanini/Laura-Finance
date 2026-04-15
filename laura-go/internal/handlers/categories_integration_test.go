//go:build integration

package handlers_test

import (
	"context"
	"testing"

	"github.com/jvzanini/laura-finance/laura-go/internal/testutil"
)

// TestCat_List_Empty — workspace novo retorna categorias vazias.
func TestCat_List_Empty(t *testing.T) {
	dep := testutil.NewTestApp(t)
	status, body := doReq(t, dep, "GET", "/api/v1/categories", "")
	if status != 200 {
		t.Fatalf("status = %d", status)
	}
	cats, _ := body["categories"].([]any)
	if len(cats) != 0 {
		t.Errorf("len(cats) = %d, esperado 0", len(cats))
	}
}

// TestCat_Create_Valid — POST /categories com payload mínimo retorna 201.
func TestCat_Create_Valid(t *testing.T) {
	dep := testutil.NewTestApp(t)
	status, body := doReq(t, dep, "POST", "/api/v1/categories",
		`{"name":"Transporte","emoji":"🚗","color":"#22c55e"}`)
	if status != 201 {
		t.Fatalf("status = %d, body = %+v", status, body)
	}
	if _, ok := body["id"].(string); !ok {
		t.Errorf("id ausente no response: %+v", body)
	}
}

// TestCat_Create_MissingName — falta nome → 400.
func TestCat_Create_MissingName(t *testing.T) {
	dep := testutil.NewTestApp(t)
	status, _ := doReq(t, dep, "POST", "/api/v1/categories", `{"emoji":"📂"}`)
	if status != 400 {
		t.Errorf("status = %d, esperado 400", status)
	}
}

// TestCat_List_WithSubcategoriesTree — GET retorna árvore aninhada.
func TestCat_List_WithSubcategoriesTree(t *testing.T) {
	dep := testutil.NewTestApp(t)
	ctx := context.Background()
	var catID string
	_ = dep.Pool.QueryRow(ctx,
		`INSERT INTO categories (workspace_id, name, emoji, color, monthly_limit_cents)
		 VALUES ($1, 'Alimentação', '🍽', '#10B981', 0) RETURNING id`,
		dep.WorkspaceID,
	).Scan(&catID)
	_, _ = dep.Pool.Exec(ctx,
		`INSERT INTO subcategories (workspace_id, category_id, name, emoji)
		 VALUES ($1, $2, 'Mercado', '🛒')`,
		dep.WorkspaceID, catID,
	)

	status, body := doReq(t, dep, "GET", "/api/v1/categories", "")
	if status != 200 {
		t.Fatalf("status = %d", status)
	}
	cats, _ := body["categories"].([]any)
	if len(cats) != 1 {
		t.Fatalf("len(cats) = %d", len(cats))
	}
	cat := cats[0].(map[string]any)
	subs, _ := cat["subcategories"].([]any)
	if len(subs) != 1 {
		t.Errorf("esperava 1 subcategoria, veio %d", len(subs))
	}
}
