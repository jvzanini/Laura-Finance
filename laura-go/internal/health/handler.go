package health

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/sync/errgroup"
)

// llmPingCache evita chamar o provider LLM em cada /ready.
var llmPingCache atomic.Value // *llmPingCacheEntry

type llmPingCacheEntry struct {
	status string
	expiry time.Time
}

// llmCheck retorna resultado do check LLM. NoOp (skipped) se disabled.
// Cache 5min para evitar custo (ping real hits o provider).
func llmCheck(ctx context.Context, llm LLMPinger, disabled bool) checkResult {
	if disabled || llm == nil {
		return checkResult{Status: "skipped"}
	}

	if cached := llmPingCache.Load(); cached != nil {
		if entry, ok := cached.(*llmPingCacheEntry); ok && time.Now().Before(entry.expiry) {
			return checkResult{Status: entry.status}
		}
	}

	cctx, ccancel := context.WithTimeout(ctx, 3*time.Second)
	defer ccancel()

	status := "reachable"
	if err := llm.Ping(cctx); err != nil {
		status = "unreachable"
	}

	llmPingCache.Store(&llmPingCacheEntry{
		status: status,
		expiry: time.Now().Add(5 * time.Minute),
	})

	return checkResult{Status: status}
}

// DBPinger é a interface mínima exigida do pool DB.
type DBPinger interface {
	Ping(ctx context.Context) error
}

// WhatsmeowChecker é a interface mínima do client Whatsmeow.
type WhatsmeowChecker interface {
	IsConnected() bool
}

// LLMPinger é a interface mínima do provider LLM.
type LLMPinger interface {
	Ping(ctx context.Context) error
}

// RedisPinger é a interface mínima do Redis (ou cache equivalente) para health check.
type RedisPinger interface {
	Ping(ctx context.Context) error
}

// Deps agrupa dependências do readiness check.
type Deps struct {
	DB               DBPinger
	Whatsmeow        WhatsmeowChecker
	LLM              LLMPinger
	Redis            RedisPinger
	Version          string
	WhatsAppDisabled bool
	LLMPingDisabled  bool
}

// Liveness retorna sempre 200 — apenas confirma processo vivo.
func Liveness(version string, startTime time.Time, buildTime string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":         "ok",
			"version":        version,
			"build_time":     buildTime,
			"uptime_seconds": int64(time.Since(startTime).Seconds()),
		})
	}
}

type checkResult struct {
	Status    string `json:"status"`
	LatencyMs int64  `json:"latency_ms,omitempty"`
}

// Readiness checa db + whatsmeow + llm em paralelo com timeout 3s.
// Retorna 503 se DB falhar; 200 "degraded" se Whatsmeow não conectado;
// 200 "ready" se tudo ok.
func Readiness(deps Deps) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.UserContext(), 3*time.Second)
		defer cancel()

		checks := map[string]checkResult{}
		var mu sync.Mutex
		g, gctx := errgroup.WithContext(ctx)

		if deps.DB != nil {
			g.Go(func() error {
				cctx, ccancel := context.WithTimeout(gctx, 500*time.Millisecond)
				defer ccancel()
				start := time.Now()
				if err := deps.DB.Ping(cctx); err != nil {
					mu.Lock()
					checks["db"] = checkResult{Status: "fail"}
					mu.Unlock()
					return err
				}
				mu.Lock()
				checks["db"] = checkResult{Status: "ok", LatencyMs: time.Since(start).Milliseconds()}
				mu.Unlock()
				return nil
			})
		}

		if deps.Redis != nil {
			g.Go(func() error {
				cctx, ccancel := context.WithTimeout(gctx, 500*time.Millisecond)
				defer ccancel()
				start := time.Now()
				if err := deps.Redis.Ping(cctx); err != nil {
					mu.Lock()
					checks["redis"] = checkResult{Status: "fail"}
					mu.Unlock()
					return nil // não bloqueia 503
				}
				mu.Lock()
				checks["redis"] = checkResult{Status: "ok", LatencyMs: time.Since(start).Milliseconds()}
				mu.Unlock()
				return nil
			})
		}

		g.Go(func() error {
			if deps.WhatsAppDisabled {
				mu.Lock()
				checks["whatsmeow"] = checkResult{Status: "disabled"}
				mu.Unlock()
				return nil
			}
			status := "disconnected"
			if deps.Whatsmeow != nil && deps.Whatsmeow.IsConnected() {
				status = "connected"
			}
			mu.Lock()
			checks["whatsmeow"] = checkResult{Status: status}
			mu.Unlock()
			return nil
		})

		g.Go(func() error {
			if deps.LLM == nil {
				mu.Lock()
				checks["llm_provider"] = checkResult{Status: "reachable"}
				mu.Unlock()
				return nil
			}
			cctx, ccancel := context.WithTimeout(gctx, 500*time.Millisecond)
			defer ccancel()
			start := time.Now()
			if err := deps.LLM.Ping(cctx); err != nil {
				mu.Lock()
				checks["llm_provider"] = checkResult{Status: "unreachable"}
				mu.Unlock()
				return nil
			}
			mu.Lock()
			checks["llm_provider"] = checkResult{Status: "reachable", LatencyMs: time.Since(start).Milliseconds()}
			mu.Unlock()
			return nil
		})

		dbErr := g.Wait()
		status := "ready"
		httpStatus := 200
		if dbErr != nil {
			status = "fail"
			httpStatus = 503
		} else if checks["whatsmeow"].Status == "disconnected" {
			status = "degraded"
		}
		return c.Status(httpStatus).JSON(fiber.Map{
			"status":  status,
			"version": deps.Version,
			"checks":  checks,
		})
	}
}
