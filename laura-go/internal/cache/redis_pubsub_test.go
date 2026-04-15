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

// TestRedisPubsub_CrossInstance valida que uma invalidação em uma
// instância propaga para outra via canal Redis pub/sub.
func TestRedisPubsub_CrossInstance(t *testing.T) {
	url := testutil.SharedRedisURL
	if url == "" {
		url = os.Getenv("REDIS_URL")
	}
	if url == "" {
		t.Skip("REDIS_URL / SharedRedisURL vazio")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	a, err := cache.NewRedisCache(url)
	if err != nil {
		t.Fatalf("NewRedisCache a: %v", err)
	}
	b, err := cache.NewRedisCache(url)
	if err != nil {
		t.Fatalf("NewRedisCache b: %v", err)
	}

	if a.InstanceID() == b.InstanceID() {
		t.Fatal("instâncias devem ter IDs diferentes")
	}

	a.Start(ctx)
	b.Start(ctx)
	time.Sleep(200 * time.Millisecond) // aguarda subscribers conectarem

	// Setar chave via A e B (mesma key, mesmo Redis) — representa
	// cache local em cada instância.
	key := "ws:test-pubsub:score:v1"
	if err := a.Set(ctx, key, []byte(`{"score":80}`), time.Minute); err != nil {
		t.Fatalf("set a: %v", err)
	}

	// Invalida via A → publica no canal → B recebe e deleta.
	if err := a.Invalidate(ctx, "ws:test-pubsub:*"); err != nil {
		t.Fatalf("invalidate a: %v", err)
	}

	// Aguarda propagação.
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		_, hit, err := b.Get(ctx, key)
		if err != nil {
			t.Fatalf("get b: %v", err)
		}
		if !hit {
			return // sucesso — chave foi invalidada.
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatal("chave não foi invalidada em B dentro do timeout de 2s")
}

// TestRedisPubsub_SelfIgnore garante que publish de uma instância não
// dispara apply nela mesma (evita double-work / loop).
func TestRedisPubsub_SelfIgnore(t *testing.T) {
	url := testutil.SharedRedisURL
	if url == "" {
		url = os.Getenv("REDIS_URL")
	}
	if url == "" {
		t.Skip("REDIS_URL vazio")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	a, err := cache.NewRedisCache(url)
	if err != nil {
		t.Fatalf("NewRedisCache: %v", err)
	}
	a.Start(ctx)
	time.Sleep(200 * time.Millisecond)

	// Set + Invalidate — não deve ocorrer erro nem panic.
	key := "ws:self-ignore:scope:v1"
	if err := a.Set(ctx, key, []byte("x"), time.Minute); err != nil {
		t.Fatalf("set: %v", err)
	}
	if err := a.Invalidate(ctx, "ws:self-ignore:*"); err != nil {
		t.Fatalf("invalidate: %v", err)
	}
	// Local já foi apagado pelo próprio Invalidate.
	_, hit, err := a.Get(ctx, key)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if hit {
		t.Fatal("chave deveria ter sido apagada localmente")
	}
}

// TestRedisPubsub_Disabled valida kill-switch CACHE_PUBSUB_DISABLED.
func TestRedisPubsub_Disabled(t *testing.T) {
	url := testutil.SharedRedisURL
	if url == "" {
		url = os.Getenv("REDIS_URL")
	}
	if url == "" {
		t.Skip("REDIS_URL vazio")
	}

	t.Setenv("CACHE_PUBSUB_DISABLED", "true")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	a, err := cache.NewRedisCache(url)
	if err != nil {
		t.Fatalf("NewRedisCache: %v", err)
	}
	a.Start(ctx) // deve ser no-op.

	// Invalidate deve funcionar local sem publish.
	if err := a.Set(ctx, "ws:disabled:x", []byte("1"), time.Minute); err != nil {
		t.Fatalf("set: %v", err)
	}
	if err := a.Invalidate(ctx, "ws:disabled:*"); err != nil {
		t.Fatalf("invalidate: %v", err)
	}
}

