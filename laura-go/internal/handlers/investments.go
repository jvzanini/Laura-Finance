package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type InvestmentItem struct {
	ID                       string    `json:"id"`
	Name                     string    `json:"name"`
	Broker                   *string   `json:"broker"`
	Type                     string    `json:"type"`
	InvestedCents            int       `json:"invested_cents"`
	CurrentCents             int       `json:"current_cents"`
	MonthlyContributionCents int       `json:"monthly_contribution_cents"`
	Emoji                    string    `json:"emoji"`
	CreatedAt                time.Time `json:"created_at"`
}

type InvestmentsResponse struct {
	Investments []InvestmentItem `json:"investments"`
	// Summary agregado pra evitar recálculo no frontend
	TotalInvestedCents           int `json:"total_invested_cents"`
	TotalCurrentCents            int `json:"total_current_cents"`
	TotalMonthlyContributionCents int `json:"total_monthly_contribution_cents"`
}

// handleListInvestments retorna investments do workspace ordenados
// por created_at desc + summary agregado.
func handleListInvestments(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx := context.Background()
	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, broker, COALESCE(type, 'Investimentos'),
		        invested_cents, current_cents,
		        COALESCE(monthly_contribution_cents, 0),
		        COALESCE(emoji, '🏦'), created_at
		 FROM investments
		 WHERE workspace_id = $1
		 ORDER BY created_at DESC`,
		sess.WorkspaceID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	investments := []InvestmentItem{}
	var totalInvested, totalCurrent, totalMonthly int
	for rows.Next() {
		var inv InvestmentItem
		if err := rows.Scan(
			&inv.ID, &inv.Name, &inv.Broker, &inv.Type,
			&inv.InvestedCents, &inv.CurrentCents, &inv.MonthlyContributionCents,
			&inv.Emoji, &inv.CreatedAt,
		); err != nil {
			continue
		}
		investments = append(investments, inv)
		totalInvested += inv.InvestedCents
		totalCurrent += inv.CurrentCents
		totalMonthly += inv.MonthlyContributionCents
	}

	return c.JSON(InvestmentsResponse{
		Investments:                   investments,
		TotalInvestedCents:            totalInvested,
		TotalCurrentCents:             totalCurrent,
		TotalMonthlyContributionCents: totalMonthly,
	})
}
