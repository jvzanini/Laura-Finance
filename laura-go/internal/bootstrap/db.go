package bootstrap

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// Config holds bootstrap configuration loaded from env.
type Config struct {
	DatabaseURL         string
	AppEnv              string
	BuildVersion        string
	SentryDSN           string
	OtelEndpoint        string
	MetricsPort         string
	Port                string
	MigrateOnBoot       bool
	DisableWhatsApp     bool
	PgMaxConns          int32
	PgMinConns          int32
	PgMaxConnLifetime   time.Duration
	PgMaxConnIdleTime   time.Duration
	PgHealthCheckPeriod time.Duration
	// LLMLegacyNoContext força ChatCompletion a descartar ctx propagado
	// (fallback rollback Fase 13 — remover após validação prod T+30d).
	LLMLegacyNoContext bool
}

// LoadConfig reads env vars and returns Config with defaults applied.
// DatabaseURL fica vazio aqui para preservar o fallback atual do pacote
// internal/db (monta DSN a partir de POSTGRES_* em dev).
func LoadConfig() Config {
	appEnv := getenv("APP_ENV", "")
	if appEnv == "" {
		appEnv = getenv("ENVIRONMENT", "development")
	}
	buildVersion := getenv("BUILD_VERSION", "")
	return Config{
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		AppEnv:              appEnv,
		BuildVersion:        buildVersion,
		SentryDSN:           os.Getenv("SENTRY_DSN_API"),
		OtelEndpoint:        os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
		MetricsPort:         getenv("METRICS_PORT", "9090"),
		Port:                getenv("PORT", "8080"),
		MigrateOnBoot:       os.Getenv("MIGRATE_ON_BOOT") == "true",
		DisableWhatsApp:     os.Getenv("DISABLE_WHATSAPP") == "true",
		PgMaxConns:          envInt32("PG_MAX_CONNS", 10),
		PgMinConns:          envInt32("PG_MIN_CONNS", 2),
		PgMaxConnLifetime:   envDuration("PG_MAX_CONN_LIFETIME", 30*time.Minute),
		PgMaxConnIdleTime:   envDuration("PG_MAX_CONN_IDLE_TIME", 5*time.Minute),
		PgHealthCheckPeriod: envDuration("PG_HEALTH_CHECK_PERIOD", 1*time.Minute),
		LLMLegacyNoContext:  os.Getenv("LLM_LEGACY_NOCONTEXT") == "true",
	}
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt32(key string, def int32) int32 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 32); err == nil {
			return int32(n)
		}
	}
	return def
}

func envDuration(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

// InitDB cria um pgxpool com tuning + otelpgx tracer, populando db.Pool
// para manter compatibilidade com código legacy que referencia db.Pool direto.
func InitDB(ctx context.Context, cfg Config) (*pgxpool.Pool, error) {
	dsn := cfg.DatabaseURL
	if dsn == "" {
		dsn = db.GetDSN()
	}
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	pgCfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse pgxpool config: %w", err)
	}
	pgCfg.MaxConns = cfg.PgMaxConns
	pgCfg.MinConns = cfg.PgMinConns
	pgCfg.MaxConnLifetime = cfg.PgMaxConnLifetime
	pgCfg.MaxConnIdleTime = cfg.PgMaxConnIdleTime
	pgCfg.HealthCheckPeriod = cfg.PgHealthCheckPeriod
	pgCfg.ConnConfig.Tracer = otelpgx.NewTracer()

	pool, err := pgxpool.NewWithConfig(ctx, pgCfg)
	if err != nil {
		return nil, fmt.Errorf("create pgxpool: %w", err)
	}
	db.Pool = pool
	return pool, nil
}
