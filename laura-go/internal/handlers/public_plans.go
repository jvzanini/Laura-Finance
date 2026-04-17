package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// publicPlan é a visão "safe" de um plano exposta publicamente na LP.
// Omite campos sensíveis (capabilities internas, ai_model_config, stripe_price_id).
type publicPlan struct {
	Slug                string          `json:"slug"`
	Name                string          `json:"name"`
	PriceCents          int             `json:"price_cents"`
	PriceCentsYearly    *int            `json:"price_cents_yearly,omitempty"`
	FeaturesDescription json.RawMessage `json:"features_description"`
	SortOrder           int             `json:"sort_order"`
	IsMostPopular       bool            `json:"is_most_popular"`
}

// handlePublicListPlans devolve os planos ativos para uso na LP pública.
// Sem auth. Filtra apenas campos seguros.
func handlePublicListPlans(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	if db.Pool == nil {
		return fiber.NewError(fiber.StatusInternalServerError, "banco não inicializado")
	}

	rows, err := db.Pool.Query(ctx,
		`SELECT slug, name, price_cents, price_cents_yearly, features_description, sort_order
		 FROM subscription_plans
		 WHERE active = TRUE
		 ORDER BY sort_order ASC, price_cents ASC`,
	)
	if err != nil {
		slog.ErrorContext(ctx, "handlePublicListPlans_query", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	var plans []publicPlan
	maxPrice := -1
	for rows.Next() {
		var p publicPlan
		var yearly *int
		if err := rows.Scan(&p.Slug, &p.Name, &p.PriceCents, &yearly, &p.FeaturesDescription, &p.SortOrder); err != nil {
			continue
		}
		p.PriceCentsYearly = yearly
		plans = append(plans, p)
		if p.PriceCents > maxPrice {
			maxPrice = p.PriceCents
		}
	}

	// Marca is_most_popular no plano com maior price_cents (se houver > 0).
	for i := range plans {
		if plans[i].PriceCents == maxPrice && maxPrice > 0 {
			plans[i].IsMostPopular = true
		}
	}

	return c.JSON(fiber.Map{"plans": plans})
}
