package cache

import (
	"context"
	"path/filepath"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"
)

type entry struct {
	value     []byte
	expiresAt time.Time
}

type InMemoryCache struct {
	mu    sync.RWMutex
	cache *lru.Cache[string, entry]
}

func NewInMemoryCache(capacity int) (*InMemoryCache, error) {
	c, err := lru.New[string, entry](capacity)
	if err != nil {
		return nil, err
	}
	return &InMemoryCache{cache: c}, nil
}

func (m *InMemoryCache) Get(ctx context.Context, key string) ([]byte, bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	e, ok := m.cache.Get(key)
	if !ok {
		return nil, false, nil
	}
	if time.Now().After(e.expiresAt) {
		m.cache.Remove(key)
		return nil, false, nil
	}
	return e.value, true, nil
}

func (m *InMemoryCache) Set(ctx context.Context, key string, val []byte, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cache.Add(key, entry{value: val, expiresAt: time.Now().Add(ttl)})
	return nil
}

func (m *InMemoryCache) Invalidate(ctx context.Context, pattern string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, k := range m.cache.Keys() {
		if matched, _ := filepath.Match(pattern, k); matched {
			m.cache.Remove(k)
		}
	}
	return nil
}
