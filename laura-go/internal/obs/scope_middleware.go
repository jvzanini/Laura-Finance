package obs

import (
	"github.com/getsentry/sentry-go"
	sentryfiber "github.com/getsentry/sentry-go/fiber"
	"github.com/gofiber/fiber/v2"
)

// ScopeEnrichmentMiddleware injeta tags e user no scope do Sentry hub
// derivando dos Locals do Fiber (requestid, workspace_id, user_id).
func ScopeEnrichmentMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if hub := sentryfiber.GetHubFromContext(c); hub != nil {
			id, _ := c.Locals("requestid").(string)
			if id != "" {
				hub.Scope().SetTag("request_id", id)
			}
			if ws, ok := c.Locals("workspace_id").(string); ok && ws != "" {
				hub.Scope().SetTag("workspace_id", ws)
				hub.Scope().SetTag("tenant_id", ws) // alias workspace_id
			}
			if uid, ok := c.Locals("user_id").(string); ok && uid != "" {
				hub.Scope().SetUser(sentry.User{ID: uid})
			}
		}
		return c.Next()
	}
}
