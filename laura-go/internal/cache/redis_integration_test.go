//go:build integration

package cache

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestRedisCache_SetGet(t *testing.T) {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		t.Skip("REDIS_URL ausente — STANDBY [REDIS-INSTANCE]")
	}
	r, err := NewRedisCache(url)
	if err != nil {
		t.Fatalf("NewRedisCache: %v", err)
	}
	ctx := context.Background()
	if err := r.Set(ctx, "test:k", []byte("v"), time.Minute); err != nil {
		t.Fatalf("Set: %v", err)
	}
	b, hit, err := r.Get(ctx, "test:k")
	if err != nil || !hit {
		t.Fatalf("Get: err=%v hit=%v", err, hit)
	}
	if string(b) != "v" {
		t.Errorf("got %q", string(b))
	}
}

func TestRedisCache_TTLExpiry(t *testing.T) {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		t.Skip("REDIS_URL ausente")
	}
	r, _ := NewRedisCache(url)
	ctx := context.Background()
	r.Set(ctx, "test:ttl", []byte("v"), 100*time.Millisecond)
	time.Sleep(200 * time.Millisecond)
	_, hit, _ := r.Get(ctx, "test:ttl")
	if hit {
		t.Error("expected miss after TTL")
	}
}
