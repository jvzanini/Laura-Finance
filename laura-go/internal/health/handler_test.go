package health

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
)

type mockDB struct{ err error }

func (m *mockDB) Ping(ctx context.Context) error { return m.err }

type mockWA struct{ connected bool }

func (m *mockWA) IsConnected() bool { return m.connected }

type mockLLM struct{ err error }

func (m *mockLLM) Ping(ctx context.Context) error { return m.err }

func TestLiveness_Returns200(t *testing.T) {
	app := fiber.New()
	app.Get("/health", Liveness("v1", time.Now().Add(-1*time.Hour), "2026-04-15T00:00:00Z"))
	resp, err := app.Test(httptest.NewRequest("GET", "/health", nil), -1)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("status %d", resp.StatusCode)
	}
}

func TestReadiness_AllHealthy_200(t *testing.T) {
	app := fiber.New()
	deps := Deps{
		DB:        &mockDB{},
		Whatsmeow: &mockWA{connected: true},
		LLM:       &mockLLM{},
		Version:   "v1",
	}
	app.Get("/ready", Readiness(deps))
	resp, err := app.Test(httptest.NewRequest("GET", "/ready", nil), -1)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("status %d", resp.StatusCode)
	}
}

func TestReadiness_DBFails_503(t *testing.T) {
	app := fiber.New()
	deps := Deps{
		DB:        &mockDB{err: errors.New("db down")},
		Whatsmeow: &mockWA{connected: true},
		LLM:       &mockLLM{},
		Version:   "v1",
	}
	app.Get("/ready", Readiness(deps))
	resp, err := app.Test(httptest.NewRequest("GET", "/ready", nil), -1)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 503 {
		t.Fatalf("status %d", resp.StatusCode)
	}
}

func TestReadiness_WhatsmeowOff_Degraded(t *testing.T) {
	app := fiber.New()
	deps := Deps{
		DB:        &mockDB{},
		Whatsmeow: &mockWA{connected: false},
		LLM:       &mockLLM{},
		Version:   "v1",
	}
	app.Get("/ready", Readiness(deps))
	resp, err := app.Test(httptest.NewRequest("GET", "/ready", nil), -1)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("status %d, want 200 (degraded ainda 200)", resp.StatusCode)
	}
}
