package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	sentryfiber "github.com/getsentry/sentry-go/fiber"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/gofiber/fiber/v2/utils"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/joho/godotenv"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/handlers"
	"github.com/jvzanini/laura-finance/laura-go/internal/migrations"
	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
	"github.com/jvzanini/laura-finance/laura-go/internal/whatsapp"
)

func runMigrations(dbURL string) error {
	src, err := migrations.Source()
	if err != nil {
		return err
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, dbURL)
	if err != nil {
		return err
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}
	v, dirty, _ := m.Version()
	slog.Info("migrations aplicadas", "version", v, "dirty", dirty)
	return nil
}

func main() {
	// Load environment variables (mostly for local development)
	_ = godotenv.Load(".env")

	// Observability: structured logger (slog).
	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = os.Getenv("ENVIRONMENT")
	}

	buildVersion := os.Getenv("BUILD_VERSION")
	if buildVersion == "" {
		buildVersion = "dev"
	}
	flushSentry := obs.InitSentry(buildVersion)
	defer flushSentry()

	logger := obs.NewLoggerWithSentry(appEnv)
	slog.SetDefault(logger)

	// Initialize PostgreSQL Connection
	if err := db.ConnectDB(); err != nil {
		slog.Error("falha ao conectar no banco", "err", err)
		os.Exit(1)
	}
	defer db.CloseDB()
	slog.Info("conexão com banco estabelecida")

	if os.Getenv("MIGRATE_ON_BOOT") == "true" {
		if err := runMigrations(db.GetDSN()); err != nil {
			slog.Error("runMigrations falhou", "err", err)
			os.Exit(1)
		}
	}

	// Initialize Fiber
	app := fiber.New(fiber.Config{
		DisableStartupMessage: false,
	})

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
	app.Use(obs.ScopeEnrichmentMiddleware())
	app.Use(recover.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendString("Laura Finance Go API is healthy!")
	})

	app.Get("/ready", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.Context(), 2*time.Second)
		defer cancel()
		if db.Pool == nil {
			return c.Status(503).JSON(fiber.Map{"status": "not-ready", "db": "pool nil"})
		}
		if err := db.Pool.Ping(ctx); err != nil {
			return c.Status(503).JSON(fiber.Map{"status": "not-ready", "db": err.Error()})
		}
		return c.JSON(fiber.Map{"status": "ready", "db": "ok"})
	})

	// Registra o namespace /api/v1/* com session middleware + CORS.
	// Mantém /api/whatsapp/validate existente em paralelo até migração
	// gradual para /api/v1/*.
	handlers.RegisterRoutes(app)

	app.Post("/api/whatsapp/validate", func(c *fiber.Ctx) error {
		type ValidateReq struct {
			Phone string `json:"phone"`
		}
		var req ValidateReq
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}
		jid, err := whatsapp.ValidateWhatsAppNumber(req.Phone)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"jid": jid})
	})

	// Start WhatsApp Client
	if os.Getenv("DISABLE_WHATSAPP") == "true" {
		slog.Info("DISABLE_WHATSAPP=true -- main pulou whatsapp init")
	} else {
		slog.Info("iniciando cliente Whatsmeow")
		whatsapp.InitWhatsmeow()
	}

	// Start AI/Budget Cron Tasks
	services.StartBudgetAlertCron(whatsapp.SendTextMessage)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	slog.Info("iniciando Laura Go server", "port", port)

	go func() {
		if err := app.Listen(":" + port); err != nil {
			slog.Error("falha ao iniciar server", "err", err)
			os.Exit(1)
		}
	}()

	// Graceful Shutdown to preserve WhatsApp Persistent Connection (crucial for Whatsmeow)
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	slog.Info("[System] Gracefully shutting down...")
	if whatsapp.Client != nil {
		whatsapp.Client.Disconnect()
	}
	slog.Info("[WhatsApp] Successfully disconnected.")
}
