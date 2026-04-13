package handlers

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type AdminOverviewResponse struct {
	TotalWorkspaces            int     `json:"total_workspaces"`
	TotalUsers                 int     `json:"total_users"`
	TotalCards                 int     `json:"total_cards"`
	UnverifiedUsers            int     `json:"unverified_users"`
	TotalRollovers             int     `json:"total_rollovers"`
	RolloversThisMonth         int     `json:"rollovers_this_month"`
	VolumeRolledCents          int64   `json:"volume_rolled_cents"`
	VolumeRolledThisMonthCents int64   `json:"volume_rolled_this_month_cents"`
	TotalFeesPaidCents         int64   `json:"total_fees_paid_cents"`
	AvgFeePercentage           float64 `json:"avg_fee_percentage"`
	TransactionsThisMonth      int     `json:"transactions_this_month"`
	ExpensesThisMonthCents     int64   `json:"expenses_this_month_cents"`
	IncomeThisMonthCents       int64   `json:"income_this_month_cents"`
}

// handleAdminOverview retorna agregados cross-workspace para o super admin.
// Equivalente ao fetchAdminOverviewAction do PWA.
func handleAdminOverview(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	var resp AdminOverviewResponse
	err := db.Pool.QueryRow(ctx,
		`SELECT
			(SELECT COUNT(*)::int FROM workspaces),
			(SELECT COUNT(*)::int FROM users),
			(SELECT COUNT(*)::int FROM cards),
			(SELECT COUNT(*)::int FROM users WHERE email_verified = FALSE),

			(SELECT COUNT(*)::int FROM debt_rollovers),
			(SELECT COUNT(*)::int FROM debt_rollovers
			 WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)),
			(SELECT COALESCE(SUM(invoice_value_cents), 0)::bigint FROM debt_rollovers),
			(SELECT COALESCE(SUM(invoice_value_cents), 0)::bigint FROM debt_rollovers
			 WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)),
			(SELECT COALESCE(SUM(total_fees_cents), 0)::bigint FROM debt_rollovers),
			(SELECT COALESCE(AVG(fee_percentage), 0)::float FROM debt_rollovers),

			(SELECT COUNT(*)::int FROM transactions
			 WHERE transaction_date >= DATE_TRUNC('month', CURRENT_DATE)),
			(SELECT COALESCE(SUM(amount), 0)::bigint FROM transactions
			 WHERE type = 'expense' AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)),
			(SELECT COALESCE(SUM(amount), 0)::bigint FROM transactions
			 WHERE type = 'income' AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE))
		`,
	).Scan(
		&resp.TotalWorkspaces, &resp.TotalUsers, &resp.TotalCards, &resp.UnverifiedUsers,
		&resp.TotalRollovers, &resp.RolloversThisMonth, &resp.VolumeRolledCents,
		&resp.VolumeRolledThisMonthCents, &resp.TotalFeesPaidCents, &resp.AvgFeePercentage,
		&resp.TransactionsThisMonth, &resp.ExpensesThisMonthCents, &resp.IncomeThisMonthCents,
	)
	if err != nil {
		log.Printf("[ERROR] handleAdminOverview: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(resp)
}
