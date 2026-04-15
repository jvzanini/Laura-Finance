package cache

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const pubsubChannel = "laura:cache:invalidate"

// InvalidatePayload é a mensagem publicada no canal pub/sub para
// invalidar cache entre instâncias.
type InvalidatePayload struct {
	InstanceID string `json:"instance_id"`
	Pattern    string `json:"pattern"`
}

// InvalidateMetrics é uma interface opcional para observability.
// Injetada via SetMetrics; bootstrap/metrics wires concrete impl.
type InvalidateMetrics interface {
	PubsubPublish(patternKind string)
	PubsubReceive(outcome string)
}

type RedisCache struct {
	cli        *redis.Client
	instanceID string
	metrics    InvalidateMetrics

	subOnce sync.Once
}

func NewRedisCache(url string) (*RedisCache, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	c := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := c.Ping(ctx).Err(); err != nil {
		return nil, err
	}
	return &RedisCache{cli: c, instanceID: uuid.New().String()}, nil
}

// InstanceID expõe o UUID desta instância (usado em pub/sub marker).
func (r *RedisCache) InstanceID() string { return r.instanceID }

// SetMetrics injeta implementação de métricas (opcional).
func (r *RedisCache) SetMetrics(m InvalidateMetrics) { r.metrics = m }

func (r *RedisCache) Get(ctx context.Context, key string) ([]byte, bool, error) {
	b, err := r.cli.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return b, true, nil
}

func (r *RedisCache) Set(ctx context.Context, key string, val []byte, ttl time.Duration) error {
	return r.cli.Set(ctx, key, val, ttl).Err()
}

// Ping verifica conectividade com Redis (usado em health check /ready).
func (r *RedisCache) Ping(ctx context.Context) error {
	return r.cli.Ping(ctx).Err()
}

// Invalidate apaga chaves locais e publica no canal pub/sub para
// outras instâncias também apagarem. Publish é no-op se
// CACHE_PUBSUB_DISABLED=true.
func (r *RedisCache) Invalidate(ctx context.Context, pattern string) error {
	if err := r.deleteKeys(ctx, pattern); err != nil {
		return err
	}
	r.publishInvalidate(ctx, pattern)
	return nil
}

func (r *RedisCache) deleteKeys(ctx context.Context, pattern string) error {
	iter := r.cli.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		if err := r.cli.Del(ctx, iter.Val()).Err(); err != nil {
			return err
		}
	}
	return iter.Err()
}

func (r *RedisCache) publishInvalidate(ctx context.Context, pattern string) {
	if os.Getenv("CACHE_PUBSUB_DISABLED") == "true" {
		return
	}
	payload := InvalidatePayload{InstanceID: r.instanceID, Pattern: pattern}
	b, err := json.Marshal(payload)
	if err != nil {
		slog.WarnContext(ctx, "cache_pubsub_marshal_failed", "err", err)
		return
	}
	if err := r.cli.Publish(ctx, pubsubChannel, b).Err(); err != nil {
		slog.WarnContext(ctx, "cache_pubsub_publish_failed", "err", err)
		if r.metrics != nil {
			r.metrics.PubsubPublish("error")
		}
		return
	}
	if r.metrics != nil {
		r.metrics.PubsubPublish(patternKind(pattern))
	}
}

// Start inicia goroutine subscriber no canal pub/sub. Chamar uma única
// vez em boot. Respeita ctx.Done() para graceful shutdown.
// No-op se CACHE_PUBSUB_DISABLED=true.
func (r *RedisCache) Start(ctx context.Context) {
	if os.Getenv("CACHE_PUBSUB_DISABLED") == "true" {
		slog.Info("cache_pubsub_disabled", "instance_id", r.instanceID)
		return
	}
	r.subOnce.Do(func() {
		go r.runSubscriber(ctx)
	})
}

func (r *RedisCache) runSubscriber(ctx context.Context) {
	backoff := time.Second
	const maxBackoff = 16 * time.Second
	consecutiveFailures := 0

	for {
		if ctx.Err() != nil {
			slog.Info("cache_pubsub_subscriber_stopped", "instance_id", r.instanceID)
			return
		}

		sub := r.cli.Subscribe(ctx, pubsubChannel)
		ch := sub.Channel()
		slog.Info("cache_pubsub_subscribed", "instance_id", r.instanceID, "channel", pubsubChannel)
		backoff = time.Second
		consecutiveFailures = 0

		for msg := range ch {
			r.handleMessage(ctx, msg.Payload)
		}

		// Channel closed — assumir erro. Fechar sub e retry.
		_ = sub.Close()
		if ctx.Err() != nil {
			return
		}

		consecutiveFailures++
		if consecutiveFailures >= 5 {
			slog.Error("cache_pubsub_subscriber_repeated_failures", "count", consecutiveFailures)
		}
		slog.Warn("cache_pubsub_subscriber_reconnecting", "backoff", backoff)
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		if backoff < maxBackoff {
			backoff *= 2
		}
	}
}

func (r *RedisCache) handleMessage(ctx context.Context, raw string) {
	var payload InvalidatePayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		slog.WarnContext(ctx, "cache_pubsub_unmarshal_failed", "err", err)
		if r.metrics != nil {
			r.metrics.PubsubReceive("invalid")
		}
		return
	}
	if payload.InstanceID == r.instanceID {
		if r.metrics != nil {
			r.metrics.PubsubReceive("self")
		}
		return
	}
	if err := r.deleteKeys(ctx, payload.Pattern); err != nil {
		slog.WarnContext(ctx, "cache_pubsub_apply_failed", "err", err, "pattern", payload.Pattern)
		if r.metrics != nil {
			r.metrics.PubsubReceive("error")
		}
		return
	}
	if r.metrics != nil {
		r.metrics.PubsubReceive("applied")
	}
}

// patternKind retorna um label low-cardinality para métricas.
// Ex: "ws:abc:dashboard:*" → "workspace".
func patternKind(pattern string) string {
	switch {
	case len(pattern) >= 3 && pattern[:3] == "ws:":
		return "workspace"
	default:
		return "other"
	}
}

