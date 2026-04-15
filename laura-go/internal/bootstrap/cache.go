package bootstrap

import (
	"context"
	"log/slog"
	"os"

	"github.com/jvzanini/laura-finance/laura-go/internal/cache"
	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
)

// InitCache cria Cache com fallback chain: REDIS_URL → InMemory.
func InitCache() cache.Cache {
	if os.Getenv("CACHE_DISABLED") == "true" {
		slog.Info("cache_disabled", "reason", "env var CACHE_DISABLED=true")
		mem, _ := cache.NewInMemoryCache(1024)
		return mem
	}
	if url := os.Getenv("REDIS_URL"); url != "" {
		r, err := cache.NewRedisCache(url)
		if err == nil {
			r.SetMetrics(obs.CachePubsubMetrics{})
			slog.Info("cache_redis_initialized", "url", url, "instance_id", r.InstanceID())
			return r
		}
		slog.Warn("cache_redis_failed_falling_back_to_memory", "err", err)
	}
	mem, _ := cache.NewInMemoryCache(1024)
	slog.Info("cache_inmemory_initialized")
	return mem
}

// StartCachePubsub inicia o subscriber pub/sub se o Cache for RedisCache.
// No-op em InMemoryCache ou se CACHE_PUBSUB_DISABLED=true.
func StartCachePubsub(ctx context.Context, c cache.Cache) {
	if rc, ok := c.(*cache.RedisCache); ok {
		rc.Start(ctx)
	}
}
