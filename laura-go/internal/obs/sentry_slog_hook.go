package obs

import (
	"context"
	"log/slog"

	"github.com/getsentry/sentry-go"
)

// SentryHandler envolve um slog.Handler e dispara CaptureException em Error
// e CaptureMessage em Warn. Em qualquer nivel abaixo, apenas delega.
type SentryHandler struct {
	inner slog.Handler
}

func NewSentryHandler(inner slog.Handler) *SentryHandler {
	return &SentryHandler{inner: inner}
}

func (h *SentryHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.inner.Enabled(ctx, level)
}

func (h *SentryHandler) Handle(ctx context.Context, r slog.Record) error {
	switch r.Level {
	case slog.LevelError:
		var capturedErr error
		r.Attrs(func(a slog.Attr) bool {
			if a.Key == "err" || a.Key == "error" {
				if e, ok := a.Value.Any().(error); ok {
					capturedErr = e
					return false
				}
			}
			return true
		})
		if capturedErr != nil {
			sentry.CaptureException(capturedErr)
		} else {
			sentry.CaptureMessage(r.Message)
		}
	case slog.LevelWarn:
		sentry.CaptureMessage(r.Message)
	}
	return h.inner.Handle(ctx, r)
}

func (h *SentryHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &SentryHandler{inner: h.inner.WithAttrs(attrs)}
}

func (h *SentryHandler) WithGroup(name string) slog.Handler {
	return &SentryHandler{inner: h.inner.WithGroup(name)}
}
