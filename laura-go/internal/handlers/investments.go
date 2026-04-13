package handlers

import (
	"context"
	"log"
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
	Investments                   []InvestmentItem `json:"investments"`
	// Summary agregado pra evitar recálculo no frontend
	TotalInvestedCents            int `json:"total_invested_cents"`
	TotalCurrentCents             int `json:"total_current_cents"`
	TotalMonthlyContributionCents int `json:"total_monthly_contribution_cents"`
}

type CreateInvestmentRequest struct {
	Name                     string `json:"name"`
	Broker                   string `json:"broker"`
	Type                     string `json:"type"`
	InvestedCents            int    `json:"invested_cents"`
	CurrentCents             *int   `json:"current_cents"`
	MonthlyContributionCents int    `json:"monthly_contribution_cents"`
	Emoji                    string `json:"emoji"`
}

type CreateInvestmentResponse struct {
	ID      string `json:"id"`
	Success bool   `json:"success"`
}

func handleCreateInvestment(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	var req CreateInvestmentRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if req.Name == "" || req.Broker == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nome e broker são obrigatórios")
	}
	if req.InvestedCents <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "valor investido deve ser positivo")
	}
	if req.Type == "" {
		req.Type = "Investimentos"
	}
	if req.Emoji == "" {
		req.Emoji = "🏦"
	}

	currentCents := req.InvestedCents
	if req.CurrentCents != nil {
		currentCents = *req.CurrentCents
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	var invID string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO investments (workspace_id, name, broker, type, invested_cents, current_cents, monthly_contribution_cents, emoji)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id`,
		sess.WorkspaceID, req.Name, req.Broker, req.Type, req.InvestedCents, currentCents, req.MonthlyContributionCents, req.Emoji,
	).Scan(&invID)
	if err != nil {
		log.Printf("[ERROR] handleCreateInvestment: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.Status(fiber.StatusCreated).JSON(CreateInvestmentResponse{ID: invID, Success: true})
}

// handleListInvestments retorna investments do workspace ordenados
// por created_at desc + summary agregado.
func handleListInvestments(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
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
		log.Printf("[ERROR] handleListInvestments: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
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
