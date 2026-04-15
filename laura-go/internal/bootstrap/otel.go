package bootstrap

import (
	"context"

	"go.opentelemetry.io/otel"

	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
)

// InitOTel configura tracer provider global.
// Endpoint vazio → NoOp shutdown.
func InitOTel(ctx context.Context, cfg Config) (shutdown func(context.Context) error, err error) {
	release := cfg.BuildVersion
	if release == "" {
		release = "dev"
	}
	tp, sd, err := obs.NewTracerProvider(ctx, release)
	if err != nil {
		return func(context.Context) error { return nil }, err
	}
	otel.SetTracerProvider(tp)
	if sd == nil {
		sd = func(context.Context) error { return nil }
	}
	return sd, nil
}
