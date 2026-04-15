package bootstrap

import (
	"log/slog"
	"os"

	"github.com/jvzanini/laura-finance/laura-go/internal/cache"
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
			slog.Info("cache_redis_initialized", "url", url)
			return r
		}
		slog.Warn("cache_redis_failed_falling_back_to_memory", "err", err)
	}
	mem, _ := cache.NewInMemoryCache(1024)
	slog.Info("cache_inmemory_initialized")
	return mem
}
