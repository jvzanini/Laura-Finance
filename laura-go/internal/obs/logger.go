package obs

import (
	"log/slog"
	"os"
	"strings"
)

func levelFromEnv(env string) slog.Level {
	switch strings.ToLower(os.Getenv("LOG_LEVEL")) {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	}
	if env == "production" {
		return slog.LevelInfo
	}
	return slog.LevelDebug
}

// NewLogger monta chain base: inner (JSON prod / Text dev) → ContextHandler.
// SentryHandler e otelslog são aplicados em wrappers separados quando habilitados.
func NewLogger(env string) *slog.Logger {
	opts := &slog.HandlerOptions{Level: levelFromEnv(env)}
	var inner slog.Handler
	if env == "production" {
		inner = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		inner = slog.NewTextHandler(os.Stdout, opts)
	}
	return slog.New(NewContextHandler(inner))
}

// NewLoggerWithSentry monta chain: inner → ContextHandler → SentryHandler
// quando SENTRY_DSN_API esta setado. Caso contrario, equivale ao NewLogger.
func NewLoggerWithSentry(env string) *slog.Logger {
	opts := &slog.HandlerOptions{Level: levelFromEnv(env)}
	var inner slog.Handler
	if env == "production" {
		inner = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		inner = slog.NewTextHandler(os.Stdout, opts)
	}
	ctxHandler := NewContextHandler(inner)
	if os.Getenv("SENTRY_DSN_API") == "" {
		return slog.New(ctxHandler)
	}
	return slog.New(NewSentryHandler(ctxHandler))
}
