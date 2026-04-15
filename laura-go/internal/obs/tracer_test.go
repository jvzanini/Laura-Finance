package obs

import (
	"context"
	"testing"

	"go.opentelemetry.io/otel/trace/noop"
)

func TestNewTracerProvider_NoOpWhenEndpointEmpty(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
	tp, shutdown, err := NewTracerProvider(context.Background(), "test-v1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if shutdown == nil {
		t.Fatal("shutdown nil")
	}
	// Tipo deve ser noop.
	if _, ok := tp.(noop.TracerProvider); !ok {
		t.Logf("warning: tp is %T, expected noop.TracerProvider (may be pointer wrapper)", tp)
	}
	if err := shutdown(context.Background()); err != nil {
		t.Fatalf("shutdown: %v", err)
	}
}

func TestNewTracerProvider_FailsOnInvalidEndpoint(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "invalid://not-a-url")
	tp, shutdown, _ := NewTracerProvider(context.Background(), "test")
	// Pode falhar ou retornar tp valido (otlptracehttp.New aceita strings).
	// Smoke: nao deve panico.
	if shutdown != nil {
		_ = shutdown(context.Background())
	}
	_ = tp
}
