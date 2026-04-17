package handlers

import (
	"context"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
)

// RequireActiveSubscription é um middleware que DEVE ser chained após
// RequireSession. Verifica se o estado de assinatura do workspace
// permite acesso. Super admin sempre passa.
func RequireActiveSubscription() fiber.Handler {
	return func(c *fiber.Ctx) error {
		sess := getSession(c)
		if sess == nil {
			return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
		}
		if sess.IsSuperAdmin {
			return c.Next()
		}

		ctx, cancel := context.WithTimeout(c.Context(), 5*time.Second)
		defer cancel()

		var (
			status                        string
			trialEndsAt, currentPeriodEnd *time.Time
			pastDueGraceUntil, canceledAt *time.Time
		)
		err := db.Pool.QueryRow(ctx,
			`SELECT subscription_status,
			        trial_ends_at, current_period_end, past_due_grace_until, canceled_at
			 FROM workspaces WHERE id = $1`,
			sess.WorkspaceID,
		).Scan(&status, &trialEndsAt, &currentPeriodEnd, &pastDueGraceUntil, &canceledAt)
		if err != nil {
			slog.ErrorContext(ctx, "paywall_workspace_lookup", "err", err)
			return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
		}

		snap := services.SubscriptionSnapshot{
			SubscriptionStatus: status,
			TrialEndsAt:        trialEndsAt,
			CurrentPeriodEnd:   currentPeriodEnd,
			PastDueGraceUntil:  pastDueGraceUntil,
			CanceledAt:         canceledAt,
		}
		state := services.ComputeState(snap, time.Now())
		if services.IsBlocked(state) {
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"error":    "subscription_blocked",
				"state":    state,
				"redirect": "/subscription",
			})
		}
		return c.Next()
	}
}
