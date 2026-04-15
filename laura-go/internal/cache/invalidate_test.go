package cache

import (
	"context"
	"testing"
	"time"
)

func TestInMemoryCache_InvalidateWorkspace_AllScopes(t *testing.T) {
	c, _ := NewInMemoryCache(100)
	ctx := context.Background()
	c.Set(ctx, "ws:abc:dashboard:x", []byte("1"), time.Minute)
	c.Set(ctx, "ws:abc:score:y", []byte("2"), time.Minute)
	c.Set(ctx, "ws:def:dashboard:z", []byte("3"), time.Minute)

	if err := InvalidateWorkspace(ctx, c, "abc", nil); err != nil {
		t.Fatalf("err: %v", err)
	}

	if _, hit, _ := c.Get(ctx, "ws:abc:dashboard:x"); hit {
		t.Error("ws:abc:dashboard:x should be invalidated")
	}
	if _, hit, _ := c.Get(ctx, "ws:def:dashboard:z"); !hit {
		t.Error("ws:def:dashboard:z should NOT be invalidated")
	}
}

func TestInMemoryCache_InvalidateWorkspace_SpecificScopes(t *testing.T) {
	c, _ := NewInMemoryCache(100)
	ctx := context.Background()
	c.Set(ctx, "ws:abc:dashboard:x", []byte("1"), time.Minute)
	c.Set(ctx, "ws:abc:score:y", []byte("2"), time.Minute)
	c.Set(ctx, "ws:abc:reports:z", []byte("3"), time.Minute)

	if err := InvalidateWorkspace(ctx, c, "abc", []string{"dashboard", "score"}); err != nil {
		t.Fatalf("err: %v", err)
	}

	if _, hit, _ := c.Get(ctx, "ws:abc:dashboard:x"); hit {
		t.Error("dashboard should be invalidated")
	}
	if _, hit, _ := c.Get(ctx, "ws:abc:score:y"); hit {
		t.Error("score should be invalidated")
	}
	if _, hit, _ := c.Get(ctx, "ws:abc:reports:z"); !hit {
		t.Error("reports should NOT be invalidated")
	}
}
