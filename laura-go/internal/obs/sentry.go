package obs

import (
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/getsentry/sentry-go"
)

// parseFloatEnv retorna o float parseado de env var, ou fallback.
func parseFloatEnv(key string, fallback float64) float64 {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return fallback
	}
	return v
}

// InitSentry inicializa o SDK quando SENTRY_DSN_API esta setado.
// Retorna um flush closure (noop quando DSN vazio).
func InitSentry(release string) func() {
	dsn := os.Getenv("SENTRY_DSN_API")
	if dsn == "" {
		slog.Info("sentry desabilitado", "reason", "SENTRY_DSN_API vazio")
		return func() {}
	}

	env := os.Getenv("APP_ENV")
	if env == "" {
		env = "development"
	}

	tracesRate := parseFloatEnv("SENTRY_TRACES_SAMPLE_RATE", 0.1)

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      env,
		Release:          release,
		TracesSampleRate: tracesRate,
		AttachStacktrace: true,
	})
	if err != nil {
		slog.Error("sentry init falhou", "err", err)
		return func() {}
	}

	slog.Info("sentry inicializado", "env", env, "release", release, "traces_rate", tracesRate)

	return func() {
		sentry.Flush(2 * time.Second)
	}
}
