package cache

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type fakeCache struct {
	mu       sync.Mutex
	store    map[string][]byte
	getCount atomic.Int32
	setCount atomic.Int32
	failGet  bool
	failSet  bool
}

func newFake() *fakeCache {
	return &fakeCache{store: map[string][]byte{}}
}

func (f *fakeCache) Get(ctx context.Context, key string) ([]byte, bool, error) {
	f.getCount.Add(1)
	if f.failGet {
		return nil, false, errors.New("get fail")
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	v, ok := f.store[key]
	return v, ok, nil
}

func (f *fakeCache) Set(ctx context.Context, key string, val []byte, ttl time.Duration) error {
	f.setCount.Add(1)
	if f.failSet {
		return errors.New("set fail")
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.store[key] = val
	return nil
}

func (f *fakeCache) Invalidate(ctx context.Context, pattern string) error {
	return nil
}

func (f *fakeCache) Ping(ctx context.Context) error {
	return nil
}

func TestGetOrCompute_Hit(t *testing.T) {
	t.Setenv("CACHE_DISABLED", "false")
	c := newFake()
	c.store["key1"] = []byte(`"hello"`)
	called := atomic.Int32{}
	v, err := GetOrCompute[string](context.Background(), c, "key1", time.Minute, func(ctx context.Context) (string, error) {
		called.Add(1)
		return "computed", nil
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if v != "hello" {
		t.Errorf("v=%q want hello", v)
	}
	if called.Load() != 0 {
		t.Errorf("compute called %d times, want 0", called.Load())
	}
}

func TestGetOrCompute_Miss(t *testing.T) {
	t.Setenv("CACHE_DISABLED", "false")
	c := newFake()
	called := atomic.Int32{}
	v, err := GetOrCompute[string](context.Background(), c, "key2", time.Minute, func(ctx context.Context) (string, error) {
		called.Add(1)
		return "computed", nil
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if v != "computed" {
		t.Errorf("v=%q", v)
	}
	if called.Load() != 1 {
		t.Errorf("compute %d", called.Load())
	}
	if c.setCount.Load() != 1 {
		t.Errorf("set %d", c.setCount.Load())
	}
}

func TestGetOrCompute_Disabled(t *testing.T) {
	t.Setenv("CACHE_DISABLED", "true")
	c := newFake()
	called := atomic.Int32{}
	v, _ := GetOrCompute[int](context.Background(), c, "k", time.Minute, func(ctx context.Context) (int, error) {
		called.Add(1)
		return 42, nil
	})
	if v != 42 {
		t.Errorf("v=%d", v)
	}
	if called.Load() != 1 {
		t.Errorf("compute %d", called.Load())
	}
	if c.setCount.Load() != 0 {
		t.Errorf("set %d", c.setCount.Load())
	}
}

func TestGetOrCompute_ComputeError(t *testing.T) {
	t.Setenv("CACHE_DISABLED", "false")
	c := newFake()
	_, err := GetOrCompute[string](context.Background(), c, "kerr", time.Minute, func(ctx context.Context) (string, error) {
		return "", errors.New("boom")
	})
	if err == nil {
		t.Fatal("expected err")
	}
	if c.setCount.Load() != 0 {
		t.Errorf("set called on error")
	}
}

func TestGetOrCompute_SingleflightDedup(t *testing.T) {
	t.Setenv("CACHE_DISABLED", "false")
	c := newFake()
	called := atomic.Int32{}
	wg := sync.WaitGroup{}
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = GetOrCompute[string](context.Background(), c, "kdedup", time.Minute, func(ctx context.Context) (string, error) {
				time.Sleep(10 * time.Millisecond)
				called.Add(1)
				return "done", nil
			})
		}()
	}
	wg.Wait()
	if called.Load() != 1 {
		t.Errorf("compute called %d, want 1 (singleflight)", called.Load())
	}
}
