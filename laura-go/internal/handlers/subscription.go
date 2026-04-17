package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
)

type subscriptionPlan struct {
	Slug             string `json:"slug"`
	Name             string `json:"name"`
	PriceCents       int    `json:"price_cents"`
	PriceCentsYearly *int   `json:"price_cents_yearly,omitempty"`
}

type subscriptionCard struct {
	Brand    string `json:"brand,omitempty"`
	Last4    string `json:"last4,omitempty"`
	ExpMonth int    `json:"exp_month,omitempty"`
	ExpYear  int    `json:"exp_year,omitempty"`
}

type subscriptionResponse struct {
	Status             string                       `json:"status"`
	State              services.SubscriptionState   `json:"state"`
	Plan               *subscriptionPlan            `json:"plan,omitempty"`
	TrialEndsAt        *time.Time                   `json:"trial_ends_at,omitempty"`
	CurrentPeriodEnd   *time.Time                   `json:"current_period_end,omitempty"`
	PastDueGraceUntil  *time.Time                   `json:"past_due_grace_until,omitempty"`
	CanceledAt         *time.Time                   `json:"canceled_at,omitempty"`
	Card               *subscriptionCard            `json:"card,omitempty"`
	IsBlocked          bool                         `json:"is_blocked"`
	DaysRemaining      int                          `json:"days_remaining"`
	FeaturesDescription []json.RawMessage `json:"-"`
}

// handleMeSubscription devolve o estado completo da assinatura para o
// usuário logado. Requer RequireSession antes no chain.
func handleMeSubscription(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	var (
		status                                       string
		currentPlanSlug                              *string
		trialEndsAt, currentPeriodEnd                *time.Time
		pastDueGraceUntil, canceledAt                *time.Time
		cardBrand, cardLast4                         *string
		cardExpMonth, cardExpYear                    *int
	)
	err := db.Pool.QueryRow(ctx,
		`SELECT subscription_status, current_plan_slug,
		        trial_ends_at, current_period_end, past_due_grace_until, canceled_at,
		        card_brand, card_last4, card_exp_month, card_exp_year
		 FROM workspaces WHERE id = $1`,
		sess.WorkspaceID,
	).Scan(&status, &currentPlanSlug,
		&trialEndsAt, &currentPeriodEnd, &pastDueGraceUntil, &canceledAt,
		&cardBrand, &cardLast4, &cardExpMonth, &cardExpYear)
	if err != nil {
		slog.ErrorContext(ctx, "handleMeSubscription_workspace", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}

	snap := services.SubscriptionSnapshot{
		SubscriptionStatus: status,
		TrialEndsAt:        trialEndsAt,
		CurrentPeriodEnd:   currentPeriodEnd,
		PastDueGraceUntil:  pastDueGraceUntil,
		CanceledAt:         canceledAt,
	}
	now := time.Now()
	state := services.ComputeState(snap, now)

	resp := subscriptionResponse{
		Status:            status,
		State:             state,
		TrialEndsAt:       trialEndsAt,
		CurrentPeriodEnd:  currentPeriodEnd,
		PastDueGraceUntil: pastDueGraceUntil,
		CanceledAt:        canceledAt,
		IsBlocked:         services.IsBlocked(state),
		DaysRemaining:     services.DaysRemaining(snap, state, now),
	}

	// Dados do plano (se houver).
	if currentPlanSlug != nil && *currentPlanSlug != "" {
		var p subscriptionPlan
		err = db.Pool.QueryRow(ctx,
			`SELECT slug, name, price_cents, price_cents_yearly
			 FROM subscription_plans WHERE slug = $1`,
			*currentPlanSlug,
		).Scan(&p.Slug, &p.Name, &p.PriceCents, &p.PriceCentsYearly)
		if err == nil {
			resp.Plan = &p
		}
	}

	// Card (se cadastrado).
	if cardLast4 != nil && *cardLast4 != "" {
		card := subscriptionCard{Last4: *cardLast4}
		if cardBrand != nil {
			card.Brand = *cardBrand
		}
		if cardExpMonth != nil {
			card.ExpMonth = *cardExpMonth
		}
		if cardExpYear != nil {
			card.ExpYear = *cardExpYear
		}
		resp.Card = &card
	}

	return c.JSON(resp)
}
