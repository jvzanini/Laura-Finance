package bootstrap

import (
	"log/slog"
	"testing"
)

func TestInitLogger_Production(t *testing.T) {
	logger := InitLogger("production")
	if logger == nil {
		t.Fatal("logger nil")
	}
	if slog.Default() != logger {
		t.Error("slog.Default not set")
	}
}

func TestInitLogger_Development(t *testing.T) {
	logger := InitLogger("development")
	if logger == nil {
		t.Fatal("logger nil")
	}
}
