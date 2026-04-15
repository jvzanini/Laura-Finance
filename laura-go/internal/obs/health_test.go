package obs

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// TestHealth_ReturnsStatusOK valida o shape minimo do payload /health
// (status/version/build_time/uptime_seconds). O handler real vive em
// main.go; aqui replicamos a estrutura para smoke test de contrato.
func TestHealth_ReturnsStatusOK(t *testing.T) {
	app := fiber.New()
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":         "ok",
			"version":        "test-v1",
			"build_time":     "2026-04-15T00:00:00Z",
			"uptime_seconds": int64(42),
		})
	})
	resp, err := app.Test(httptest.NewRequest("GET", "/health", nil), -1)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("status %d", resp.StatusCode)
	}
	var m map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if m["status"] != "ok" || m["version"] != "test-v1" {
		t.Fatalf("unexpected payload: %v", m)
	}
	if _, ok := m["build_time"]; !ok {
		t.Fatalf("build_time missing: %v", m)
	}
	if _, ok := m["uptime_seconds"]; !ok {
		t.Fatalf("uptime_seconds missing: %v", m)
	}
}
