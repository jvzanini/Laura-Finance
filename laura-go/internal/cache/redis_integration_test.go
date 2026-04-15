//go:build integration

package cache_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jvzanini/laura-finance/laura-go/internal/cache"
	"github.com/jvzanini/laura-finance/laura-go/internal/testutil"
)

// resolveRedisURL prefere o container compartilhado (testutil.SharedRedisURL)
// mas cai para REDIS_URL do env quando executado fora do TestMain (ex: go
// test direto neste pacote).
func resolveRedisURL() string {
	if testutil.SharedRedisURL != "" {
		return testutil.SharedRedisURL
	}
	return os.Getenv("REDIS_URL")
}

func TestRedisCache_SetGet(t *testing.T) {
	url := resolveRedisURL()
	if url == "" {
		t.Skip("Redis indisponível — sem SharedRedisURL nem REDIS_URL")
	}
	r, err := cache.NewRedisCache(url)
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
	url := resolveRedisURL()
	if url == "" {
		t.Skip("Redis indisponível")
	}
	r, _ := cache.NewRedisCache(url)
	ctx := context.Background()
	_ = r.Set(ctx, "test:ttl", []byte("v"), 100*time.Millisecond)
	time.Sleep(200 * time.Millisecond)
	_, hit, _ := r.Get(ctx, "test:ttl")
	if hit {
		t.Error("expected miss after TTL")
	}
}
