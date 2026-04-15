package bootstrap

import (
	"testing"
)

func TestInitCache_Disabled(t *testing.T) {
	t.Setenv("CACHE_DISABLED", "true")
	c := InitCache()
	if c == nil {
		t.Fatal("nil")
	}
}

func TestInitCache_NoRedisURL_FallsBackToMemory(t *testing.T) {
	t.Setenv("CACHE_DISABLED", "false")
	t.Setenv("REDIS_URL", "")
	c := InitCache()
	if c == nil {
		t.Fatal("nil")
	}
}

func TestInitCache_InvalidRedisURL_FallsBack(t *testing.T) {
	t.Setenv("CACHE_DISABLED", "false")
	t.Setenv("REDIS_URL", "redis://invalid-host-xyz:6379")
	c := InitCache()
	if c == nil {
		t.Fatal("nil")
	}
}
