package obs

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
)

func TestRespondError_Shape(t *testing.T) {
	codes := []struct {
		code   string
		status int
	}{
		{CodeValidationFailed, 400},
		{CodeAuthInvalidCredentials, 401},
		{CodeAuthTokenExpired, 401},
		{CodeForbidden, 403},
		{CodeNotFound, 404},
		{CodeConflict, 409},
		{CodeRateLimited, 429},
		{CodeInternal, 500},
		{CodeDBTimeout, 504},
		{CodeLLMProviderDown, 503},
		{CodeDependencyDown, 502},
	}
	for _, tc := range codes {
		t.Run(tc.code, func(t *testing.T) {
			app := fiber.New()
			app.Get("/", func(c *fiber.Ctx) error {
				c.Locals("requestid", "req-test")
				return RespondError(c, tc.code, tc.status, errors.New("boom"))
			})
			req := httptest.NewRequest("GET", "/", nil)
			resp, err := app.Test(req, -1)
			if err != nil {
				t.Fatalf("Test: %v", err)
			}
			if resp.StatusCode != tc.status {
				t.Fatalf("status %d, want %d", resp.StatusCode, tc.status)
			}
			var payload struct {
				Error ErrorBody `json:"error"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if payload.Error.Code != tc.code {
				t.Fatalf("code %q, want %q", payload.Error.Code, tc.code)
			}
			if payload.Error.Message == "" {
				t.Fatal("message empty")
			}
			if payload.Error.RequestID != "req-test" {
				t.Fatalf("request_id %q", payload.Error.RequestID)
			}
			if _, perr := time.Parse(time.RFC3339, payload.Error.Timestamp); perr != nil {
				t.Fatalf("timestamp not RFC3339: %v (%q)", perr, payload.Error.Timestamp)
			}
		})
	}
}

func TestRespondError_5xxLogsError_4xxLogsWarn(t *testing.T) {
	// Smoke test apenas para garantir que o helper retorna OK em ambos os casos.
	app := fiber.New()
	app.Get("/server", func(c *fiber.Ctx) error {
		return RespondError(c, CodeInternal, 500, errors.New("boom"))
	})
	app.Get("/client", func(c *fiber.Ctx) error {
		return RespondError(c, CodeNotFound, 404, errors.New("missing"))
	})
	for _, p := range []string{"/server", "/client"} {
		resp, err := app.Test(httptest.NewRequest("GET", p, nil), -1)
		if err != nil {
			t.Fatalf("Test %s: %v", p, err)
		}
		if !strings.Contains(resp.Header.Get("Content-Type"), "json") {
			t.Fatalf("%s content-type %q", p, resp.Header.Get("Content-Type"))
		}
	}
}
