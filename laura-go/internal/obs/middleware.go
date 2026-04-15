package obs

import (
	"log/slog"

	"github.com/gofiber/fiber/v2"
)

func LoggerMiddleware(base *slog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		id, _ := c.Locals("requestid").(string)
		logger := base.With("request_id", id)
		ctx := c.UserContext()
		ctx = WithRequestID(ctx, id)
		ctx = WithLogger(ctx, logger)
		c.SetUserContext(ctx)
		c.Locals("logger", logger)
		return c.Next()
	}
}
