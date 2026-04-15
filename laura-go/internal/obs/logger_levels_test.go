package obs

import (
	"log/slog"
	"testing"
)

func TestLevelFromEnv_ExplicitDebug(t *testing.T) {
	t.Setenv("LOG_LEVEL", "debug")
	if got := levelFromEnv("production"); got != slog.LevelDebug {
		t.Fatalf("expected Debug, got %v", got)
	}
}

func TestLevelFromEnv_ExplicitWarn(t *testing.T) {
	t.Setenv("LOG_LEVEL", "warn")
	if got := levelFromEnv("dev"); got != slog.LevelWarn {
		t.Fatalf("expected Warn, got %v", got)
	}
}

func TestLevelFromEnv_ExplicitError(t *testing.T) {
	t.Setenv("LOG_LEVEL", "ERROR")
	if got := levelFromEnv("dev"); got != slog.LevelError {
		t.Fatalf("expected Error, got %v", got)
	}
}

func TestLevelFromEnv_DefaultProduction(t *testing.T) {
	t.Setenv("LOG_LEVEL", "")
	if got := levelFromEnv("production"); got != slog.LevelInfo {
		t.Fatalf("expected Info default in prod, got %v", got)
	}
}

func TestLevelFromEnv_DefaultDev(t *testing.T) {
	t.Setenv("LOG_LEVEL", "")
	if got := levelFromEnv("dev"); got != slog.LevelDebug {
		t.Fatalf("expected Debug default in dev, got %v", got)
	}
}

func TestNewLogger_Production(t *testing.T) {
	t.Setenv("LOG_LEVEL", "info")
	l := NewLogger("production")
	if l == nil {
		t.Fatal("NewLogger returned nil")
	}
	l.Info("smoke")
}

func TestNewLogger_Dev(t *testing.T) {
	t.Setenv("LOG_LEVEL", "debug")
	l := NewLogger("dev")
	if l == nil {
		t.Fatal("NewLogger returned nil")
	}
	l.Debug("smoke")
}

func TestNewLoggerWithSentry_NoDSN(t *testing.T) {
	t.Setenv("SENTRY_DSN_API", "")
	l := NewLoggerWithSentry("production")
	if l == nil {
		t.Fatal("NewLoggerWithSentry returned nil")
	}
	l.Info("smoke")
}
