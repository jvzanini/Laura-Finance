package handlers

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type DebtRolloverItem struct {
	ID                string    `json:"id"`
	CreatedAt         time.Time `json:"date"`
	CardName          string    `json:"card"`
	CardColor         string    `json:"card_color"`
	Institution       string    `json:"institution"`
	InvoiceValueCents int       `json:"invoice_value_cents"`
	TotalFeesCents    int       `json:"total_fees_cents"`
	TotalOperations   int       `json:"total_operations"`
	Installments      string    `json:"installments"`
	Status            string    `json:"status"`
}

type DebtRolloversResponse struct {
	Rollovers []DebtRolloverItem `json:"rollovers"`
}

func handleListDebtRollovers(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
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
		log.Printf("[ERROR] handleListDebtRollovers: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
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

type CreateDebtRolloverRequest struct {
	CardID            string  `json:"card_id"`
	Institution       string  `json:"institution"`
	InvoiceValueCents int     `json:"invoice_value_cents"`
	TotalFeesCents    int     `json:"total_fees_cents"`
	TotalOperations   int     `json:"total_operations"`
	Installments      string  `json:"installments"`
	FeePercentage     float64 `json:"fee_percentage"`
	OperationsJSON    string  `json:"operations_json"`
}

func handleCreateDebtRollover(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	var req CreateDebtRolloverRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if req.CardID == "" || req.Institution == "" {
		return fiber.NewError(fiber.StatusBadRequest, "card_id e institution são obrigatórios")
	}
	if req.InvoiceValueCents <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "invoice_value_cents deve ser positivo")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	var id string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO debt_rollovers (
			workspace_id, card_id, institution, invoice_value_cents,
			total_fees_cents, total_operations, installments, fee_percentage, operations_json
		 )
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id`,
		sess.WorkspaceID, req.CardID, req.Institution, req.InvoiceValueCents,
		req.TotalFeesCents, req.TotalOperations, req.Installments,
		req.FeePercentage, req.OperationsJSON,
	).Scan(&id)
	if err != nil {
		log.Printf("[ERROR] handleCreateDebtRollover: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "success": true})
}
