package cache

import (
	"context"
	"testing"
	"time"
)

func TestInMemoryCache_TTLExpiry(t *testing.T) {
	c, _ := NewInMemoryCache(10)
	ctx := context.Background()
	_ = c.Set(ctx, "k", []byte("v"), 50*time.Millisecond)
	time.Sleep(100 * time.Millisecond)
	_, hit, _ := c.Get(ctx, "k")
	if hit {
		t.Error("expected miss after TTL")
	}
}

func TestInMemoryCache_LRUEviction(t *testing.T) {
	c, _ := NewInMemoryCache(2)
	ctx := context.Background()
	_ = c.Set(ctx, "a", []byte("1"), time.Minute)
	_ = c.Set(ctx, "b", []byte("2"), time.Minute)
	_ = c.Set(ctx, "c", []byte("3"), time.Minute)
	_, hit, _ := c.Get(ctx, "a")
	if hit {
		t.Error("expected 'a' evicted")
	}
}

func TestInMemoryCache_Ping(t *testing.T) {
	c, _ := NewInMemoryCache(4)
	if err := c.Ping(context.Background()); err != nil {
		t.Fatalf("Ping should be no-op, got %v", err)
	}
}

func TestInMemoryCache_GetMiss(t *testing.T) {
	c, _ := NewInMemoryCache(4)
	ctx := context.Background()
	v, hit, err := c.Get(ctx, "missing")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if hit {
		t.Fatalf("expected miss, hit=%v v=%q", hit, v)
	}
}

func TestInMemoryCache_InvalidatePattern(t *testing.T) {
	c, _ := NewInMemoryCache(10)
	ctx := context.Background()
	_ = c.Set(ctx, "ws:123:foo", []byte("1"), time.Minute)
	_ = c.Set(ctx, "ws:123:bar", []byte("2"), time.Minute)
	_ = c.Set(ctx, "ws:456:foo", []byte("3"), time.Minute)
	_ = c.Invalidate(ctx, "ws:123:*")
	_, hit, _ := c.Get(ctx, "ws:123:foo")
	if hit {
		t.Error("ws:123:foo should be invalidated")
	}
	_, hit, _ = c.Get(ctx, "ws:456:foo")
	if !hit {
		t.Error("ws:456:foo should NOT be invalidated")
	}
}
