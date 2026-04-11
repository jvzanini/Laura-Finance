package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type InvoiceItem struct {
	ID          string     `json:"id"`
	CardID      string     `json:"card_id"`
	CardName    string     `json:"card_name"`
	CardColor   string     `json:"card_color"`
	TotalCents  int        `json:"total_cents"`
	DueDate     string     `json:"due_date"` // YYYY-MM-DD
	PaidAt      *time.Time `json:"paid_at"`
	Status      string     `json:"status"` // open | paid | overdue (derivado)
}

type InvoicesResponse struct {
	Invoices []InvoiceItem `json:"invoices"`
}

func handleListInvoices(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx := context.Background()
	rows, err := db.Pool.Query(ctx,
		`SELECT i.id, i.card_id, COALESCE(c.name, 'Cartão removido'),
		        COALESCE(c.color, '#71717A'), i.total_cents, i.due_date, i.paid_at
		 FROM invoices i
		 LEFT JOIN cards c ON c.id = i.card_id
		 WHERE i.workspace_id = $1
		 ORDER BY i.due_date DESC`,
		sess.WorkspaceID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	now := time.Now()
	year, month, day := now.Date()
	todayMidnight := time.Date(year, month, day, 0, 0, 0, 0, now.Location())

	items := []InvoiceItem{}
	for rows.Next() {
		var inv InvoiceItem
		var dueDate time.Time
		if err := rows.Scan(&inv.ID, &inv.CardID, &inv.CardName, &inv.CardColor, &inv.TotalCents, &dueDate, &inv.PaidAt); err != nil {
			continue
		}
		inv.DueDate = dueDate.Format("2006-01-02")
		switch {
		case inv.PaidAt != nil:
			inv.Status = "paid"
		case dueDate.Before(todayMidnight):
			inv.Status = "overdue"
		default:
			inv.Status = "open"
		}
		items = append(items, inv)
	}
	return c.JSON(InvoicesResponse{Invoices: items})
}
