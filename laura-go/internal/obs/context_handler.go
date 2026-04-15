package obs

import (
	"context"
	"log/slog"

	"go.opentelemetry.io/otel/trace"
)

type ContextHandler struct{ inner slog.Handler }

func NewContextHandler(inner slog.Handler) *ContextHandler { return &ContextHandler{inner: inner} }

func (h *ContextHandler) Enabled(ctx context.Context, lvl slog.Level) bool {
	return h.inner.Enabled(ctx, lvl)
}

func (h *ContextHandler) Handle(ctx context.Context, r slog.Record) error {
	if id := RequestIDFromCtx(ctx); id != "" {
		r.AddAttrs(slog.String("request_id", id))
	}
	if sc := trace.SpanContextFromContext(ctx); sc.IsValid() {
		r.AddAttrs(
			slog.String("trace_id", sc.TraceID().String()),
			slog.String("span_id", sc.SpanID().String()),
		)
	}
	return h.inner.Handle(ctx, r)
}

func (h *ContextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &ContextHandler{inner: h.inner.WithAttrs(attrs)}
}

func (h *ContextHandler) WithGroup(name string) slog.Handler {
	return &ContextHandler{inner: h.inner.WithGroup(name)}
}
