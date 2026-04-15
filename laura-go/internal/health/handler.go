package health

import (
	"context"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/sync/errgroup"
)

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

// Deps agrupa dependências do readiness check.
type Deps struct {
	DB               DBPinger
	Whatsmeow        WhatsmeowChecker
	LLM              LLMPinger
	Version          string
	WhatsAppDisabled bool
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
