package handlers

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestOpsBackupHandler_NoTokenConfigured_403(t *testing.T) {
	t.Setenv("BACKUP_OPS_TOKEN", "")
	app := fiber.New()
	app.Post("/api/ops/backup", OpsBackupHandler)
	req := httptest.NewRequest("POST", "/api/ops/backup", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 403 {
		t.Fatalf("status %d, want 403", resp.StatusCode)
	}
}

func TestOpsBackupHandler_NoHeader_401(t *testing.T) {
	t.Setenv("BACKUP_OPS_TOKEN", "secret-token")
	app := fiber.New()
	app.Post("/api/ops/backup", OpsBackupHandler)
	req := httptest.NewRequest("POST", "/api/ops/backup", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 401 {
		t.Fatalf("status %d, want 401", resp.StatusCode)
	}
}

func TestOpsBackupHandler_InvalidToken_403(t *testing.T) {
	t.Setenv("BACKUP_OPS_TOKEN", "secret-token")
	app := fiber.New()
	app.Post("/api/ops/backup", OpsBackupHandler)
	req := httptest.NewRequest("POST", "/api/ops/backup", nil)
	req.Header.Set("X-Ops-Token", "wrong")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 403 {
		t.Fatalf("status %d, want 403", resp.StatusCode)
	}
}

func TestOpsBackupHandler_ValidToken_DryRun_200(t *testing.T) {
	t.Setenv("BACKUP_OPS_TOKEN", "secret-token")
	t.Setenv("BACKUP_DRY", "1")
	app := fiber.New()
	app.Post("/api/ops/backup", OpsBackupHandler)
	req := httptest.NewRequest("POST", "/api/ops/backup", nil)
	req.Header.Set("X-Ops-Token", "secret-token")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("status %d, want 200", resp.StatusCode)
	}
}
