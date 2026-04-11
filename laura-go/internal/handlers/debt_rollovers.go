package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type DebtRolloverItem struct {
	ID               string    `json:"id"`
	CreatedAt        time.Time `json:"date"`
	CardName         string    `json:"card"`
	CardColor        string    `json:"card_color"`
	Institution      string    `json:"institution"`
	InvoiceValueCents int      `json:"invoice_value_cents"`
	TotalFeesCents   int       `json:"total_fees_cents"`
	TotalOperations  int       `json:"total_operations"`
	Installments     string    `json:"installments"`
	Status           string    `json:"status"`
}

type DebtRolloversResponse struct {
	Rollovers []DebtRolloverItem `json:"rollovers"`
}

func handleListDebtRollovers(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx := context.Background()
	rows, err := db.Pool.Query(ctx,
		`SELECT dr.id, dr.created_at, COALESCE(c.name, 'Cartão removido'),
		        COALESCE(c.color, '#808080'), dr.institution, dr.invoice_value_cents,
		        dr.total_fees_cents, dr.total_operations, dr.installments,
		        COALESCE(dr.status, 'concluido')
		 FROM debt_rollovers dr
		 LEFT JOIN cards c ON c.id = dr.card_id
		 WHERE dr.workspace_id = $1
		 ORDER BY dr.created_at DESC`,
		sess.WorkspaceID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	items := []DebtRolloverItem{}
	for rows.Next() {
		var r DebtRolloverItem
		if err := rows.Scan(&r.ID, &r.CreatedAt, &r.CardName, &r.CardColor, &r.Institution,
			&r.InvoiceValueCents, &r.TotalFeesCents, &r.TotalOperations, &r.Installments, &r.Status); err != nil {
			continue
		}
		items = append(items, r)
	}
	return c.JSON(DebtRolloversResponse{Rollovers: items})
}
