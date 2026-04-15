package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	sentryfiber "github.com/getsentry/sentry-go/fiber"
	"github.com/gofiber/contrib/otelfiber/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/gofiber/fiber/v2/utils"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/joho/godotenv"
	"go.opentelemetry.io/otel"
	"golang.org/x/sync/errgroup"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/handlers"
	"github.com/jvzanini/laura-finance/laura-go/internal/migrations"
	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
	"github.com/jvzanini/laura-finance/laura-go/internal/whatsapp"
)

// Injetados via -ldflags "-X main.buildVersion=... -X main.buildTime=..."
// no Dockerfile. Fallback "dev"/"unknown" para builds locais.
var (
	buildVersion = "dev"
	buildTime    = "unknown"
	startTime    = time.Now()
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

	// BUILD_VERSION env override (usado em dev / CI) tem precedencia sobre
	// o valor injetado via -ldflags (que fica como fallback compilado).
	if v := os.Getenv("BUILD_VERSION"); v != "" {
		buildVersion = v
	}
	flushSentry := obs.InitSentry(buildVersion)
	defer flushSentry()

	// OpenTelemetry tracing — NoOp quando OTEL_EXPORTER_OTLP_ENDPOINT vazio.
	otelCtx := context.Background()
	tp, otelShutdown, err := obs.NewTracerProvider(otelCtx, buildVersion)
	if err != nil {
		slog.Error("otel_init", "err", err)
	} else {
		otel.SetTracerProvider(tp)
		defer func() { _ = otelShutdown(context.Background()) }()
	}

	logger := obs.NewLoggerWithSentry(appEnv)
	slog.SetDefault(logger)

	// Initialize PostgreSQL Connection
	if err := db.ConnectDB(); err != nil {
		slog.Error("falha ao conectar no banco", "err", err)
		os.Exit(1)
	}
	defer db.CloseDB()
	slog.Info("conexão com banco estabelecida")

	// Collector pgxpool stats (gauges em :9090/metrics).
	pgxCtx, pgxCancel := context.WithCancel(context.Background())
	defer pgxCancel()
	obs.StartPgxStatsCollector(pgxCtx, db.Pool)

	if os.Getenv("MIGRATE_ON_BOOT") == "true" {
		if err := runMigrations(db.GetDSN()); err != nil {
			slog.Error("runMigrations falhou", "err", err)
			os.Exit(1)
		}
	}

	// Initialize Fiber
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

	// Metrics: Fiber separado na :9090 + middleware Prometheus no app principal.
	metricsApp, prom := obs.NewMetricsApp()
	app.Use(prom.Middleware)
	go func() {
		if err := metricsApp.Listen(":9090"); err != nil {
			slog.Error("metrics_app_listen", "err", err)
		}
	}()

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":         "ok",
			"version":        buildVersion,
			"build_time":     buildTime,
			"uptime_seconds": int64(time.Since(startTime).Seconds()),
		})
	})

	app.Get("/ready", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.UserContext(), 3*time.Second)
		defer cancel()

		type checkResult struct {
			Status    string `json:"status"`
			LatencyMs int64  `json:"latency_ms,omitempty"`
		}
		checks := map[string]checkResult{}
		var mu sync.Mutex
		g, gctx := errgroup.WithContext(ctx)

		g.Go(func() error {
			cctx, ccancel := context.WithTimeout(gctx, 500*time.Millisecond)
			defer ccancel()
			start := time.Now()
			if db.Pool == nil {
				mu.Lock()
				checks["db"] = checkResult{Status: "fail"}
				mu.Unlock()
				return errors.New("db pool nil")
			}
			if err := db.Pool.Ping(cctx); err != nil {
				mu.Lock()
				checks["db"] = checkResult{Status: "fail"}
				mu.Unlock()
				return err
			}
			mu.Lock()
			checks["db"] = checkResult{Status: "ok", LatencyMs: time.Since(start).Milliseconds()}
			mu.Unlock()
			return nil
		})

		g.Go(func() error {
			// whatsmeow check simplificado: DISABLE_WHATSAPP=true => disabled.
			// Implementacao mais robusta (referencia ao client global) fica para
			// fase 12 caso precisemos distinguir connected vs reconnecting.
			if os.Getenv("DISABLE_WHATSAPP") == "true" {
				mu.Lock()
				checks["whatsmeow"] = checkResult{Status: "disabled"}
				mu.Unlock()
				return nil
			}
			mu.Lock()
			checks["whatsmeow"] = checkResult{Status: "connected"}
			mu.Unlock()
			return nil
		})

		g.Go(func() error {
			// LLM check: NoOp por enquanto (provider Ping nao implementado).
			mu.Lock()
			checks["llm_provider"] = checkResult{Status: "reachable"}
			mu.Unlock()
			return nil
		})

		dbErr := g.Wait()
		status := "ready"
		httpStatus := 200
		if dbErr != nil {
			status = "fail"
			httpStatus = 503
		} else if checks["whatsmeow"].Status != "connected" && checks["whatsmeow"].Status != "disabled" {
			status = "degraded"
		}
		return c.Status(httpStatus).JSON(fiber.Map{
			"status":  status,
			"version": buildVersion,
			"checks":  checks,
		})
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
	if err := metricsApp.ShutdownWithTimeout(2 * time.Second); err != nil {
		slog.Warn("metrics_app_shutdown", "err", err)
	}
	if whatsapp.Client != nil {
		whatsapp.Client.Disconnect()
	}
	slog.Info("[WhatsApp] Successfully disconnected.")
}
