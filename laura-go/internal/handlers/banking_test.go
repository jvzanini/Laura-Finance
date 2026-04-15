package handlers

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestBankingConnect_NotConfigured(t *testing.T) {
	t.Setenv("PLUGGY_CLIENT_ID", "")
	t.Setenv("PLUGGY_CLIENT_SECRET", "")
	resetPluggyClient()

	app := fiber.New()
	app.Post("/api/v1/banking/connect", handleBankingConnect)

	resp, err := app.Test(httptest.NewRequest("POST", "/api/v1/banking/connect", nil), -1)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	if resp.StatusCode != fiber.StatusNotImplemented {
		t.Fatalf("status %d, want 501", resp.StatusCode)
	}
}

func TestBankingConnect_Configured(t *testing.T) {
	// Pós-Fase 14 (e96e2ad): handler faz HTTP real contra Pluggy API.
	// Com credenciais fake o /auth retorna 401 (ErrPluggyAuthFailed → 500).
	// O importante é que NÃO retornou 501 (que é o path "não configurado").
	// Smoke real com credenciais válidas fica em workflow pluggy-smoke.
	t.Setenv("PLUGGY_CLIENT_ID", "test-id")
	t.Setenv("PLUGGY_CLIENT_SECRET", "test-secret")
	resetPluggyClient()

	app := fiber.New()
	app.Post("/api/v1/banking/connect", handleBankingConnect)

	resp, err := app.Test(httptest.NewRequest("POST", "/api/v1/banking/connect", nil), -1)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	if resp.StatusCode == fiber.StatusNotImplemented {
		t.Fatalf("status %d: handler rejected creds as not configured", resp.StatusCode)
	}
	// Aceita 200 (rede real liberada) ou 500 (auth fail com creds fake).
	if resp.StatusCode != fiber.StatusOK && resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("status %d, want 200 or 500", resp.StatusCode)
	}
}

func TestBankingSync_Unauthorized_NoToken(t *testing.T) {
	t.Setenv("BACKUP_OPS_TOKEN", "expected-token")

	app := fiber.New()
	app.Post("/api/v1/banking/sync", handleBankingSync)

	resp, err := app.Test(httptest.NewRequest("POST", "/api/v1/banking/sync", nil), -1)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("status %d, want 401", resp.StatusCode)
	}
}

func TestBankingSync_Unauthorized_WrongToken(t *testing.T) {
	t.Setenv("BACKUP_OPS_TOKEN", "expected-token")

	app := fiber.New()
	app.Post("/api/v1/banking/sync", handleBankingSync)

	req := httptest.NewRequest("POST", "/api/v1/banking/sync", nil)
	req.Header.Set("X-Ops-Token", "wrong")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("status %d, want 401", resp.StatusCode)
	}
}

func TestBankingSync_Disabled(t *testing.T) {
	t.Setenv("BACKUP_OPS_TOKEN", "expected-token")
	t.Setenv("FEATURE_BANK_SYNC", "off")

	app := fiber.New()
	app.Post("/api/v1/banking/sync", handleBankingSync)

	req := httptest.NewRequest("POST", "/api/v1/banking/sync", nil)
	req.Header.Set("X-Ops-Token", "expected-token")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status %d, want 200", resp.StatusCode)
	}
}

func TestBankingSync_Enabled(t *testing.T) {
	t.Setenv("BACKUP_OPS_TOKEN", "expected-token")
	t.Setenv("FEATURE_BANK_SYNC", "on")

	app := fiber.New()
	app.Post("/api/v1/banking/sync", handleBankingSync)

	req := httptest.NewRequest("POST", "/api/v1/banking/sync", nil)
	req.Header.Set("X-Ops-Token", "expected-token")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status %d, want 200", resp.StatusCode)
	}
}
