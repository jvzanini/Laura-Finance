package obs

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"testing"
)

func TestInitSentry_NoOpWhenDSNEmpty(t *testing.T) {
	t.Setenv("SENTRY_DSN_API", "")
	flush := InitSentry("test-version")
	defer flush()
	// Sem DSN, init deve funcionar sem panic.
}

func TestSentryHandler_DoesNotCaptureBelowWarn(t *testing.T) {
	t.Setenv("SENTRY_DSN_API", "")
	inner := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	h := NewSentryHandler(inner)
	r := slog.Record{
		Level:   slog.LevelInfo,
		Message: "info-msg",
	}
	if err := h.Handle(context.Background(), r); err != nil {
		t.Fatalf("Handle: %v", err)
	}
}

func TestSentryHandler_CaptureOnError_NoOpWithoutDSN(t *testing.T) {
	t.Setenv("SENTRY_DSN_API", "")
	flush := InitSentry("test")
	defer flush()
	inner := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	h := NewSentryHandler(inner)
	r := slog.Record{
		Level:   slog.LevelError,
		Message: "boom",
	}
	r.AddAttrs(slog.Any("err", errors.New("test error")))
	if err := h.Handle(context.Background(), r); err != nil {
		t.Fatalf("Handle: %v", err)
	}
	// Sem DSN, captura e NoOp; nao deve panico.
}
