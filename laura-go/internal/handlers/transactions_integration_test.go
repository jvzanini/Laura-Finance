//go:build integration

package handlers_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/jvzanini/laura-finance/laura-go/internal/testutil"
)

// helper local: executa request autenticado e retorna (status, body map).
func doReq(t *testing.T, dep *testutil.AppDeps, method, path string, body string) (int, map[string]any) {
	t.Helper()
	var req *http.Request
	if body == "" {
		req, _ = http.NewRequest(method, path, nil)
	} else {
		req, _ = http.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	}
	req.AddCookie(dep.Cookie)
	resp, err := dep.App.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	raw, _ := io.ReadAll(resp.Body)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return resp.StatusCode, out
}

// TestTx_List_Empty — workspace novo não tem transações.
func TestTx_List_Empty(t *testing.T) {
	dep := testutil.NewTestApp(t)
	status, body := doReq(t, dep, "GET", "/api/v1/transactions", "")
	if status != 200 {
		t.Fatalf("status = %d", status)
	}
	if toInt(body["total_count"]) != 0 {
		t.Errorf("total_count = %v, esperado 0", body["total_count"])
	}
}

// TestTx_List_Paginated — 5 txs, limit=2 retorna 2 items mas total=5.
func TestTx_List_Paginated(t *testing.T) {
	dep := testutil.NewTestApp(t)
	ctx := context.Background()
	for i := 0; i < 5; i++ {
		_, _ = dep.Pool.Exec(ctx,
			`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
			 VALUES ($1, $2, 'expense', $3, CURRENT_TIMESTAMP)`,
			dep.WorkspaceID, 10000*(i+1), fmt.Sprintf("Tx %d", i+1),
		)
	}
	status, body := doReq(t, dep, "GET", "/api/v1/transactions?limit=2", "")
	if status != 200 {
		t.Fatalf("status = %d", status)
	}
	txs, _ := body["transactions"].([]any)
	if len(txs) != 2 {
		t.Errorf("len(txs) = %d, esperado 2", len(txs))
	}
	if toInt(body["total_count"]) != 5 {
		t.Errorf("total_count = %v, esperado 5", body["total_count"])
	}
}

// TestTx_Update_Category_Success — PUT /transactions/:id/category com
// categoria válida retorna 200 e success true.
func TestTx_Update_Category_Success(t *testing.T) {
	dep := testutil.NewTestApp(t)
	ctx := context.Background()
	var txID, catID string
	_ = dep.Pool.QueryRow(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
		 VALUES ($1, 10000, 'expense', 'Test', CURRENT_TIMESTAMP) RETURNING id`,
		dep.WorkspaceID,
	).Scan(&txID)
	_ = dep.Pool.QueryRow(ctx,
		`INSERT INTO categories (workspace_id, name, emoji, color, monthly_limit_cents)
		 VALUES ($1, 'Food', '🍔', '#ff0000', 0) RETURNING id`,
		dep.WorkspaceID,
	).Scan(&catID)

	status, body := doReq(t, dep, "PUT", "/api/v1/transactions/"+txID+"/category",
		fmt.Sprintf(`{"category_id":"%s"}`, catID))
	if status != 200 {
		t.Fatalf("status = %d, body = %+v", status, body)
	}
	if body["success"] != true {
		t.Errorf("success = %v", body["success"])
	}
}

// TestTx_Update_Category_NotFound — id inexistente retorna 404.
func TestTx_Update_Category_NotFound(t *testing.T) {
	dep := testutil.NewTestApp(t)
	status, _ := doReq(t, dep, "PUT", "/api/v1/transactions/00000000-0000-0000-0000-000000000000/category",
		`{"category_id":"00000000-0000-0000-0000-000000000000"}`)
	if status != 404 {
		t.Errorf("status = %d, esperado 404", status)
	}
}

// TestTx_Update_Category_BadJSON — body inválido → 400.
func TestTx_Update_Category_BadJSON(t *testing.T) {
	dep := testutil.NewTestApp(t)
	status, _ := doReq(t, dep, "PUT", "/api/v1/transactions/abc/category", `{bad json`)
	if status != 400 {
		t.Errorf("status = %d, esperado 400", status)
	}
}

// TestTx_Delete_Success — delete de tx do próprio workspace retorna 200.
func TestTx_Delete_Success(t *testing.T) {
	dep := testutil.NewTestApp(t)
	ctx := context.Background()
	var txID string
	_ = dep.Pool.QueryRow(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
		 VALUES ($1, 10000, 'expense', 'Test', CURRENT_TIMESTAMP) RETURNING id`,
		dep.WorkspaceID,
	).Scan(&txID)

	status, body := doReq(t, dep, "DELETE", "/api/v1/transactions/"+txID, "")
	if status != 200 {
		t.Fatalf("status = %d, body = %+v", status, body)
	}
	if body["success"] != true {
		t.Errorf("success = %v", body["success"])
	}
}

// TestTx_WorkspaceIsolation — usuário de workspace A não deleta tx de
// workspace B (rowsAffected = 0 → 404).
func TestTx_WorkspaceIsolation(t *testing.T) {
	depA := testutil.NewTestApp(t)
	depB := testutil.NewTestApp(t)
	ctx := context.Background()
	var txID string
	_ = depB.Pool.QueryRow(ctx,
		`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
		 VALUES ($1, 10000, 'expense', 'WS-B only', CURRENT_TIMESTAMP) RETURNING id`,
		depB.WorkspaceID,
	).Scan(&txID)

	status, _ := doReq(t, depA, "DELETE", "/api/v1/transactions/"+txID, "")
	if status != 404 {
		t.Errorf("status = %d, esperado 404 (isolação)", status)
	}
}

func toInt(v any) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case int64:
		return int(n)
	}
	return 0
}
