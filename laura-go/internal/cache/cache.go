package cache

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"time"

	"golang.org/x/sync/singleflight"
)

// Cache é a interface para implementações Redis ou InMemory.
type Cache interface {
	Get(ctx context.Context, key string) ([]byte, bool, error)
	Set(ctx context.Context, key string, val []byte, ttl time.Duration) error
	Invalidate(ctx context.Context, pattern string) error
	Ping(ctx context.Context) error
}

// sg é o singleflight.Group global para deduplicação de computes em flight.
var sg singleflight.Group

// GetOrCompute tenta GET; em miss/erro, executa fn() (deduplicado via singleflight),
// faz Set com TTL e retorna. Respeita CACHE_DISABLED env var.
func GetOrCompute[T any](ctx context.Context, c Cache, key string, ttl time.Duration, fn func(ctx context.Context) (T, error)) (T, error) {
	var zero T

	if os.Getenv("CACHE_DISABLED") == "true" {
		return fn(ctx)
	}

	// HIT path
	if c != nil {
		raw, hit, err := c.Get(ctx, key)
		if err == nil && hit {
			var v T
			if uerr := json.Unmarshal(raw, &v); uerr == nil {
				return v, nil
			}
			// Unmarshal falhou — log warn, refaz compute.
			slog.WarnContext(ctx, "cache_unmarshal_failed", "key", key, "err", "unmarshal")
		}
	}

	// MISS path com singleflight
	v, err, _ := sg.Do(key, func() (any, error) {
		return fn(ctx)
	})
	if err != nil {
		return zero, err
	}
	val, ok := v.(T)
	if !ok {
		return zero, errors.New("cache: type assertion failed")
	}

	// SET assíncrono (não bloqueia)
	if c != nil {
		raw, merr := json.Marshal(val)
		if merr == nil {
			_ = c.Set(ctx, key, raw, ttl)
		}
	}
	return val, nil
}
