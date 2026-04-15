//go:build integration

package handlers_test

import (
	"net/http"
	"testing"

	"github.com/jvzanini/laura-finance/laura-go/internal/testutil"
)

// TestBank_Accounts_EmptyStub — stub retorna lista vazia enquanto
// integração Pluggy não é ativada por workspace.
func TestBank_Accounts_EmptyStub(t *testing.T) {
	dep := testutil.NewTestApp(t)
	status, body := doReq(t, dep, "GET", "/api/v1/banking/accounts", "")
	if status != 200 {
		t.Fatalf("status = %d", status)
	}
	accts, _ := body["accounts"].([]any)
	if len(accts) != 0 {
		t.Errorf("esperava stub vazio, veio %d accounts", len(accts))
	}
}

// TestBank_Connect_SemCredenciais — sem PLUGGY_CLIENT_ID o handler
// retorna 501 (Pluggy not configured).
func TestBank_Connect_SemCredenciais(t *testing.T) {
	t.Setenv("PLUGGY_CLIENT_ID", "")
	t.Setenv("PLUGGY_CLIENT_SECRET", "")
	dep := testutil.NewTestApp(t)
	status, body := doReq(t, dep, "POST", "/api/v1/banking/connect", "")
	if status != 501 {
		t.Fatalf("status = %d, esperado 501", status)
	}
	if body["error"] == nil {
		t.Errorf("faltou campo 'error' no 501: %+v", body)
	}
}

// TestBank_Sync_SemToken — POST /api/v1/banking/sync sem X-Ops-Token
// retorna 401.
func TestBank_Sync_SemToken(t *testing.T) {
	t.Setenv("BACKUP_OPS_TOKEN", "secret-ops")
	dep := testutil.NewTestApp(t)
	req, _ := http.NewRequest("POST", "/api/v1/banking/sync", nil)
	// sem header X-Ops-Token
	resp, err := dep.App.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != 401 {
		t.Errorf("status = %d, esperado 401", resp.StatusCode)
	}
}

// TestBank_Sync_FlagOff — com token válido mas FEATURE_BANK_SYNC=off
// retorna 200 com status=disabled.
func TestBank_Sync_FlagOff(t *testing.T) {
	t.Setenv("BACKUP_OPS_TOKEN", "secret-ops")
	t.Setenv("FEATURE_BANK_SYNC", "off")
	dep := testutil.NewTestApp(t)
	req, _ := http.NewRequest("POST", "/api/v1/banking/sync", nil)
	req.Header.Set("X-Ops-Token", "secret-ops")
	resp, err := dep.App.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, esperado 200", resp.StatusCode)
	}
}
