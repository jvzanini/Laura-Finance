package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"

	"github.com/jvzanini/laura-finance/laura-go/internal/bootstrap"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/handlers"
	"github.com/jvzanini/laura-finance/laura-go/internal/health"
	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
	"github.com/jvzanini/laura-finance/laura-go/internal/whatsapp"
)

// Injetados via -ldflags no Dockerfile.
var (
	buildVersion = "dev"
	buildTime    = "unknown"
	startTime    = time.Now()
)

func main() {
	_ = godotenv.Load(".env")

	cfg := bootstrap.LoadConfig()
	if cfg.BuildVersion != "" {
		buildVersion = cfg.BuildVersion
	}
	cfg.BuildVersion = buildVersion

	flushSentry, _ := bootstrap.InitSentry(cfg)
	defer flushSentry()

	ctx := context.Background()
	otelShutdown, err := bootstrap.InitOTel(ctx, cfg)
	if err != nil {
		slog.Error("otel_init", "err", err)
	}
	defer func() { _ = otelShutdown(context.Background()) }()

	logger := bootstrap.InitLogger(cfg.AppEnv)

	pool, err := bootstrap.InitDB(ctx, cfg)
	if err != nil {
		logger.Error("falha ao conectar no banco", "err", err)
		os.Exit(1)
	}
	defer db.CloseDB()
	logger.Info("conexão com banco estabelecida")

	pgxCtx, pgxCancel := context.WithCancel(context.Background())
	defer pgxCancel()
	obs.StartPgxStatsCollector(pgxCtx, pool)
	obs.StartPoolExhaustionMonitor(pgxCtx, pool)

	if cfg.MigrateOnBoot {
		if err := bootstrap.RunMigrations(db.GetDSN()); err != nil {
			logger.Error("runMigrations falhou", "err", err)
			os.Exit(1)
		}
	}

	app := bootstrap.NewFiberApp(logger)

	metricsRes, _ := bootstrap.InitMetrics()
	app.Use(metricsRes.Prometheus.Middleware)
	go func() {
		if err := metricsRes.App.Listen(":" + cfg.MetricsPort); err != nil {
			slog.Error("metrics_app_listen", "err", err)
		}
	}()

	app.Get("/health", health.Liveness(buildVersion, startTime, buildTime))
	handlers.Cache = bootstrap.InitCache()
	bootstrap.StartCachePubsub(pgxCtx, handlers.Cache)

	// Pluggy webhook worker (feature flag FEATURE_PLUGGY_WEBHOOKS).
	// syncFunc será injetada quando services.SyncWorkspacePluggy for
	// implementado. Por enquanto nil → worker loga e marca error.
	bootstrap.StartWebhookWorker(pgxCtx, pool, nil)

	app.Get("/ready", health.Readiness(health.Deps{
		DB:               pool,
		Whatsmeow:        whatsapp.Manager,
		Redis:            handlers.Cache,
		Version:          buildVersion,
		WhatsAppDisabled: cfg.DisableWhatsApp,
		LLMPingDisabled:  cfg.LLMPingDisabled,
	}))

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

	if cfg.DisableWhatsApp {
		logger.Info("DISABLE_WHATSAPP=true -- main pulou whatsapp init")
	} else {
		logger.Info("iniciando cliente Whatsmeow")
		whatsapp.InitWhatsmeow()
	}

	services.StartBudgetAlertCron(whatsapp.SendTextMessage)

	logger.Info("iniciando Laura Go server", "port", cfg.Port, "version", buildVersion)
	go func() {
		if err := app.Listen(":" + cfg.Port); err != nil {
			logger.Error("falha ao iniciar server", "err", err)
			os.Exit(1)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig

	logger.Info("[System] Gracefully shutting down...")
	if err := metricsRes.App.ShutdownWithTimeout(2 * time.Second); err != nil {
		logger.Warn("metrics_app_shutdown", "err", err)
	}
	if whatsapp.Client != nil {
		whatsapp.Client.Disconnect()
	}
	logger.Info("[WhatsApp] Successfully disconnected.")
}
