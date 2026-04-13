package handlers

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type InvoiceItem struct {
	ID         string     `json:"id"`
	CardID     string     `json:"card_id"`
	CardName   string     `json:"card_name"`
	CardColor  string     `json:"card_color"`
	TotalCents int        `json:"total_cents"`
	DueDate    string     `json:"due_date"` // YYYY-MM-DD
	PaidAt     *time.Time `json:"paid_at"`
	Status     string     `json:"status"` // open | paid | overdue (derivado)
}

type InvoicesResponse struct {
	Invoices []InvoiceItem `json:"invoices"`
}

func handleListInvoices(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
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
		log.Printf("[ERROR] handleListInvoices: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
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

type CreateInvoiceRequest struct {
	CardID     string `json:"card_id"`
	MonthRef   string `json:"month_ref"`
	TotalCents int    `json:"total_cents"`
	DueDate    string `json:"due_date"`
}

func handleCreateInvoice(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	var req CreateInvoiceRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if req.CardID == "" || req.MonthRef == "" || req.DueDate == "" {
		return fiber.NewError(fiber.StatusBadRequest, "card_id, month_ref e due_date são obrigatórios")
	}
	if req.TotalCents <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "total_cents deve ser positivo")
	}

	monthRef := req.MonthRef
	if len(monthRef) == 7 {
		monthRef = monthRef + "-01"
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO invoices (workspace_id, card_id, month_ref, total_cents, due_date)
		 VALUES ($1, $2, $3::date, $4, $5::date)
		 ON CONFLICT (workspace_id, card_id, month_ref)
		 DO UPDATE SET total_cents = EXCLUDED.total_cents, due_date = EXCLUDED.due_date, updated_at = CURRENT_TIMESTAMP`,
		sess.WorkspaceID, req.CardID, monthRef, req.TotalCents, req.DueDate,
	)
	if err != nil {
		log.Printf("[ERROR] handleCreateInvoice: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true})
}

func handleMarkInvoicePaid(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	id := c.Params("id")
	if id == "" {
		return fiber.NewError(fiber.StatusBadRequest, "id é obrigatório")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	tag, err := db.Pool.Exec(ctx,
		`UPDATE invoices SET paid_at = CURRENT_TIMESTAMP, status = 'paid', updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND workspace_id = $2`,
		id, sess.WorkspaceID,
	)
	if err != nil {
		log.Printf("[ERROR] handleMarkInvoicePaid: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	if tag.RowsAffected() == 0 {
		return fiber.NewError(fiber.StatusNotFound, "fatura não encontrada")
	}
	return c.JSON(fiber.Map{"success": true})
}
