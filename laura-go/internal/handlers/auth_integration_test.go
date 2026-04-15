//go:build integration

package handlers_test

import (
	"net/http"
	"testing"

	"github.com/jvzanini/laura-finance/laura-go/internal/testutil"
)

// TestAuth_Session_SemCookie garante que middleware RequireSession
// bloqueia request sem cookie de sessão.
func TestAuth_Session_SemCookie(t *testing.T) {
	dep := testutil.NewTestApp(t)
	req, _ := http.NewRequest("GET", "/api/v1/me", nil)
	resp, err := dep.App.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %d, esperado 401", resp.StatusCode)
	}
}

// TestAuth_Session_ComCookieValido permite acesso a rota protegida.
func TestAuth_Session_ComCookieValido(t *testing.T) {
	dep := testutil.NewTestApp(t)
	req, _ := http.NewRequest("GET", "/api/v1/me", nil)
	req.AddCookie(dep.Cookie)
	resp, err := dep.App.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, esperado 200", resp.StatusCode)
	}
}

// TestAuth_Session_CookieMalformado deve retornar 401 para valor
// fora do formato base64payload.base64hmac.
func TestAuth_Session_CookieMalformado(t *testing.T) {
	dep := testutil.NewTestApp(t)
	req, _ := http.NewRequest("GET", "/api/v1/me", nil)
	req.AddCookie(&http.Cookie{Name: testutil.SessionCookieName, Value: "lixo-invalido"})
	resp, err := dep.App.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %d, esperado 401", resp.StatusCode)
	}
}

// TestAuth_Session_HMACInvalido — payload base64 válido mas assinatura
// não bate com SESSION_SECRET → 401.
func TestAuth_Session_HMACInvalido(t *testing.T) {
	dep := testutil.NewTestApp(t)
	req, _ := http.NewRequest("GET", "/api/v1/me", nil)
	// payload legitimo + assinatura lixo
	req.AddCookie(&http.Cookie{
		Name:  testutil.SessionCookieName,
		Value: "eyJ1c2VySWQiOiJhYmMiLCJleHAiOjk5OTk5OTk5OTk5OTl9.invalidsignatureXXX==",
	})
	resp, err := dep.App.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %d, esperado 401", resp.StatusCode)
	}
}

// TestAuth_AdminOverview_RequerSuperAdmin — user normal → 403.
func TestAuth_AdminOverview_RequerSuperAdmin(t *testing.T) {
	dep := testutil.NewTestApp(t)
	req, _ := http.NewRequest("GET", "/api/v1/admin/overview", nil)
	req.AddCookie(dep.Cookie)
	resp, err := dep.App.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("status = %d, esperado 403", resp.StatusCode)
	}
}

// TestAuth_Health_Publico — health não requer sessão.
func TestAuth_Health_Publico(t *testing.T) {
	dep := testutil.NewTestApp(t)
	req, _ := http.NewRequest("GET", "/api/v1/health", nil)
	resp, err := dep.App.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, esperado 200", resp.StatusCode)
	}
}
