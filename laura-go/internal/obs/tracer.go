package obs

import (
	"context"
	"os"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
)

// NewTracerProvider monta um TracerProvider OTel com exporter OTLP/HTTP.
// Se OTEL_EXPORTER_OTLP_ENDPOINT estiver vazio, retorna um NoOp TracerProvider
// (modo graceful: OTel preparado mas inativo até endpoint ser configurado).
//
// Sample rate via OTEL_TRACES_SAMPLE_RATE (default 0.1 = 10%).
// Retorna (tp, shutdown, err) — shutdown deve ser chamado no graceful shutdown.
func NewTracerProvider(ctx context.Context, version string) (trace.TracerProvider, func(context.Context) error, error) {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		return noop.NewTracerProvider(), func(context.Context) error { return nil }, nil
	}
	exp, err := otlptracehttp.New(ctx, otlptracehttp.WithEndpoint(endpoint))
	if err != nil {
		return nil, nil, err
	}
	res, _ := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName("laura-api"),
			semconv.ServiceVersion(version),
			attribute.String("deployment.environment", os.Getenv("APP_ENV")),
		),
	)
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(parseFloatEnv("OTEL_TRACES_SAMPLE_RATE", 0.1)))),
	)
	return tp, tp.Shutdown, nil
}
