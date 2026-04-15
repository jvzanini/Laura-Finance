package db

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func GetDSN() string {
	// Se DATABASE_URL estiver definida, usa diretamente (produção)
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		return dsn
	}

	// Fallback: monta a partir de variáveis individuais (dev)
	user := envOr("POSTGRES_USER", "laura")
	password := os.Getenv("POSTGRES_PASSWORD")
	if password == "" {
		if os.Getenv("APP_ENV") == "production" {
			slog.Error("POSTGRES_PASSWORD obrigatória em produção")
			os.Exit(1)
		}
		fmt.Fprintln(os.Stderr, "[WARN] POSTGRES_PASSWORD não definida — usando default de desenvolvimento")
		password = "laura_password"
	}
	host := envOr("POSTGRES_HOST", "127.0.0.1")
	port := envOr("POSTGRES_PORT", "5433")
	dbName := envOr("POSTGRES_DB", "laura_finance")

	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", user, password, host, port, dbName)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func ConnectDB() error {
	dsn := GetDSN()

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("error parsing db config: %v", err)
	}

	// OpenTelemetry tracing em queries pgx (NoOp se TracerProvider for NoOp).
	config.ConnConfig.Tracer = otelpgx.NewTracer()

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return fmt.Errorf("error connecting to db: %v", err)
	}

	Pool = pool
	return nil
}

func CloseDB() {
	if Pool != nil {
		Pool.Close()
	}
}
