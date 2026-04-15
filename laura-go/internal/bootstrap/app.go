package bootstrap

import (
	"log/slog"
	"time"

	sentryfiber "github.com/getsentry/sentry-go/fiber"
	"github.com/gofiber/contrib/otelfiber/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/gofiber/fiber/v2/utils"

	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
)

// NewFiberApp cria o app Fiber principal com todos os middlewares
// padronizados (error handler, otel, sentry, requestid, logger, workspace,
// scope, recover). Retorna o app pronto para registrar rotas.
func NewFiberApp(logger *slog.Logger) *fiber.App {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: false,
		ErrorHandler:          obs.GlobalErrorHandler,
	})

	app.Use(otelfiber.Middleware())
	app.Use(sentryfiber.New(sentryfiber.Options{
		Repanic:         true,
		WaitForDelivery: false,
		Timeout:         2 * time.Second,
	}))
	app.Use(requestid.New(requestid.Config{
		Header:     "X-Request-Id",
		Generator:  utils.UUIDv4,
		ContextKey: "requestid",
	}))
	app.Use(obs.LoggerMiddleware(logger))
	app.Use(obs.WorkspaceLabelMiddleware())
	app.Use(obs.ScopeEnrichmentMiddleware())
	app.Use(recover.New())

	return app
}
