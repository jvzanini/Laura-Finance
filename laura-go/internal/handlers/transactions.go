package handlers

import (
	"context"
	"log"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type TransactionItem struct {
	ID              string    `json:"id"`
	Amount          int       `json:"amount"` // cents
	Type            string    `json:"type"`
	Description     string    `json:"description"`
	TransactionDate time.Time `json:"transaction_date"`
	CategoryID      *string   `json:"category_id"`
	CategoryName    *string   `json:"category_name"`
	CardID          *string   `json:"card_id"`
	CardName        *string   `json:"card_name"`
	NeedsReview     bool      `json:"needs_review"`
	ConfidenceScore *float64  `json:"confidence_score"`
	Tags            []string  `json:"tags"`
}

type TransactionsResponse struct {
	Transactions []TransactionItem `json:"transactions"`
	TotalCount   int               `json:"total_count"`
}

// handleListTransactions retorna as transactions do workspace com
// limit/offset via query params. Default limit=30.
func handleListTransactions(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	limit := 30
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 200 {
		limit = l
	}
	offset := 0
	if o, err := strconv.Atoi(c.Query("offset")); err == nil && o >= 0 {
		offset = o
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	// Count total pra paginação
	var totalCount int
	_ = db.Pool.QueryRow(ctx,
		"SELECT COUNT(*)::int FROM transactions WHERE workspace_id = $1",
		sess.WorkspaceID,
	).Scan(&totalCount)

	rows, err := db.Pool.Query(ctx,
		`SELECT t.id, t.amount, t.type, t.description, t.transaction_date,
		        t.category_id, c.name AS category_name,
		        t.card_id, cd.name AS card_name,
		        COALESCE(t.needs_review, FALSE), t.confidence_score, COALESCE(t.tags, '{}')
		 FROM transactions t
		 LEFT JOIN categories c ON c.id = t.category_id
		 LEFT JOIN cards cd ON cd.id = t.card_id
		 WHERE t.workspace_id = $1
		 ORDER BY t.transaction_date DESC, t.created_at DESC
		 LIMIT $2 OFFSET $3`,
		sess.WorkspaceID, limit, offset,
	)
	if err != nil {
		log.Printf("[ERROR] handleListTransactions: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []TransactionItem{}
	for rows.Next() {
		var t TransactionItem
		if err := rows.Scan(
			&t.ID, &t.Amount, &t.Type, &t.Description, &t.TransactionDate,
			&t.CategoryID, &t.CategoryName,
			&t.CardID, &t.CardName,
			&t.NeedsReview, &t.ConfidenceScore, &t.Tags,
		); err != nil {
			continue
		}
		items = append(items, t)
	}

	return c.JSON(TransactionsResponse{Transactions: items, TotalCount: totalCount})
}

func handleDeleteTransaction(c *fiber.Ctx) error {
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
		"DELETE FROM transactions WHERE id = $1 AND workspace_id = $2",
		id, sess.WorkspaceID,
	)
	if err != nil {
		log.Printf("[ERROR] handleDeleteTransaction: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	if tag.RowsAffected() == 0 {
		return fiber.NewError(fiber.StatusNotFound, "transação não encontrada")
	}
	return c.JSON(fiber.Map{"success": true})
}

type UpdateTransactionCategoryRequest struct {
	CategoryID string `json:"category_id"`
}

func handleUpdateTransactionCategory(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	id := c.Params("id")
	if id == "" {
		return fiber.NewError(fiber.StatusBadRequest, "id é obrigatório")
	}

	var req UpdateTransactionCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if req.CategoryID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "category_id é obrigatório")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	tag, err := db.Pool.Exec(ctx,
		"UPDATE transactions SET category_id = $1, needs_review = false WHERE id = $2 AND workspace_id = $3",
		req.CategoryID, id, sess.WorkspaceID,
	)
	if err != nil {
		log.Printf("[ERROR] handleUpdateTransactionCategory: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	if tag.RowsAffected() == 0 {
		return fiber.NewError(fiber.StatusNotFound, "transação não encontrada")
	}
	return c.JSON(fiber.Map{"success": true})
}
