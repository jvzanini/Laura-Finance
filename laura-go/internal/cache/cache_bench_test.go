package cache

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"
)

func BenchmarkHitRatio(b *testing.B) {
	c := newFake()
	ctx := context.Background()

	// Warm-up: popula 100 keys
	for i := 0; i < 100; i++ {
		key := fmt.Sprintf("key%d", i)
		_, _ = GetOrCompute[string](ctx, c, key, time.Minute, func(ctx context.Context) (string, error) {
			return "val", nil
		})
	}

	hits := atomic.Int32{}
	misses := atomic.Int32{}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// 80% read existing keys, 20% new
		var key string
		if i%5 == 0 {
			key = fmt.Sprintf("new%d", i)
			misses.Add(1)
		} else {
			key = fmt.Sprintf("key%d", i%100)
			hits.Add(1)
		}
		_, _ = GetOrCompute[string](ctx, c, key, time.Minute, func(ctx context.Context) (string, error) {
			return "computed", nil
		})
	}
	b.StopTimer()

	total := hits.Load() + misses.Load()
	if total > 0 {
		ratio := float64(hits.Load()) / float64(total)
		b.Logf("hit ratio: %.2f%% (hits=%d misses=%d)", ratio*100, hits.Load(), misses.Load())
	}
}
