package bootstrap

import (
	"context"
	"testing"
)

func TestInitOTelNoOp(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
	cfg := LoadConfig()
	shutdown, err := InitOTel(context.Background(), cfg)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if shutdown == nil {
		t.Fatal("shutdown nil")
	}
	if err := shutdown(context.Background()); err != nil {
		t.Errorf("shutdown err: %v", err)
	}
}
