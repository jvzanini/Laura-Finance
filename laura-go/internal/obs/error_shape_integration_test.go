package obs

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// Integration: monta Fiber app com handlers stub para CADA codigo
// e valida shape end-to-end + request_id propagado.
func TestErrorShape_AllCodesEndToEnd(t *testing.T) {
	app := fiber.New()
	codes := []struct {
		path   string
		code   string
		status int
	}{
		{"/v", CodeValidationFailed, 400},
		{"/a1", CodeAuthInvalidCredentials, 401},
		{"/a2", CodeAuthTokenExpired, 401},
		{"/f", CodeForbidden, 403},
		{"/n", CodeNotFound, 404},
		{"/c", CodeConflict, 409},
		{"/r", CodeRateLimited, 429},
		{"/i", CodeInternal, 500},
		{"/dbt", CodeDBTimeout, 504},
		{"/llm", CodeLLMProviderDown, 503},
		{"/dep", CodeDependencyDown, 502},
	}
	for _, tc := range codes {
		tc := tc
		app.Get(tc.path, func(c *fiber.Ctx) error {
			c.Locals("requestid", "integ-req")
			return RespondError(c, tc.code, tc.status, errors.New("integration boom"))
		})
	}
	for _, tc := range codes {
		t.Run(tc.code, func(t *testing.T) {
			req := httptest.NewRequest("GET", tc.path, nil)
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
				t.Fatalf("code mismatch: %s vs %s", payload.Error.Code, tc.code)
			}
			if payload.Error.RequestID != "integ-req" {
				t.Fatalf("request_id missing")
			}
		})
	}
}
