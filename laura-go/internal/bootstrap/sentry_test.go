package bootstrap

import (
	"testing"
)

func TestInitSentryNoOp(t *testing.T) {
	t.Setenv("SENTRY_DSN_API", "")
	cfg := LoadConfig()
	flush, err := InitSentry(cfg)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if flush == nil {
		t.Fatal("flush nil")
	}
	flush() // não deve panic
}
