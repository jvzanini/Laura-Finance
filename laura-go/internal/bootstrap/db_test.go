package bootstrap

import (
	"os"
	"testing"
	"time"
)

func TestLoadConfig_DefaultsWhenEmpty(t *testing.T) {
	os.Unsetenv("PG_MAX_CONNS")
	os.Unsetenv("PG_MIN_CONNS")
	os.Unsetenv("PG_MAX_CONN_LIFETIME")
	cfg := LoadConfig()
	if cfg.PgMaxConns != 10 {
		t.Errorf("PgMaxConns = %d, want 10", cfg.PgMaxConns)
	}
	if cfg.PgMinConns != 2 {
		t.Errorf("PgMinConns = %d, want 2", cfg.PgMinConns)
	}
	if cfg.PgMaxConnLifetime != 30*time.Minute {
		t.Errorf("PgMaxConnLifetime = %v, want 30m", cfg.PgMaxConnLifetime)
	}
}

func TestLoadConfig_OverridesViaEnv(t *testing.T) {
	t.Setenv("PG_MAX_CONNS", "50")
	cfg := LoadConfig()
	if cfg.PgMaxConns != 50 {
		t.Errorf("PgMaxConns = %d, want 50", cfg.PgMaxConns)
	}
}

func TestLoadConfig_InvalidDurationFallsBack(t *testing.T) {
	t.Setenv("PG_MAX_CONN_LIFETIME", "not-a-duration")
	cfg := LoadConfig()
	if cfg.PgMaxConnLifetime != 30*time.Minute {
		t.Errorf("PgMaxConnLifetime should fallback, got %v", cfg.PgMaxConnLifetime)
	}
}
