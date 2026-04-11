package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type CardItem struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Brand            *string `json:"brand"`
	Color            string  `json:"color"`
	ClosingDay       *int    `json:"closing_day"`
	DueDay           *int    `json:"due_day"`
	LastFour         *string `json:"last_four"`
	CardType         string  `json:"card_type"`
	BankBroker       *string `json:"bank_broker"`
	Holder           *string `json:"holder"`
	CreditLimitCents int     `json:"credit_limit_cents"`
}

type CardsResponse struct {
	Cards []CardItem `json:"cards"`
}

type CreateCardRequest struct {
	Name             string  `json:"name"`
	Brand            *string `json:"brand"`
	Color            string  `json:"color"`
	ClosingDay       *int    `json:"closing_day"`
	DueDay           *int    `json:"due_day"`
	LastFour         *string `json:"last_four"`
	CardType         string  `json:"card_type"`
	BankBroker       *string `json:"bank_broker"`
	Holder           *string `json:"holder"`
	CreditLimitCents int     `json:"credit_limit_cents"`
}

type CreateCardResponse struct {
	ID      string `json:"id"`
	Success bool   `json:"success"`
}

func handleCreateCard(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	var req CreateCardRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nome do cartão é obrigatório")
	}
	if req.CardType == "" {
		req.CardType = "credito"
	}
	if req.Color == "" {
		req.Color = "#7C3AED"
	}

	ctx := context.Background()
	var cardID string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO cards (workspace_id, name, brand, color, closing_day, due_day, last_four, card_type, bank_broker, holder, credit_limit_cents)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 RETURNING id`,
		sess.WorkspaceID, req.Name, req.Brand, req.Color, req.ClosingDay, req.DueDay, req.LastFour, req.CardType, req.BankBroker, req.Holder, req.CreditLimitCents,
	).Scan(&cardID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(CreateCardResponse{ID: cardID, Success: true})
}

func handleListCards(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx := context.Background()
	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, brand, COALESCE(color, '#7C3AED'), closing_day, due_day, last_four,
		        COALESCE(card_type, 'credito'), bank_broker, holder, COALESCE(credit_limit_cents, 0)
		 FROM cards
		 WHERE workspace_id = $1
		 ORDER BY name ASC`,
		sess.WorkspaceID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	cards := []CardItem{}
	for rows.Next() {
		var c CardItem
		if err := rows.Scan(&c.ID, &c.Name, &c.Brand, &c.Color, &c.ClosingDay, &c.DueDay, &c.LastFour, &c.CardType, &c.BankBroker, &c.Holder, &c.CreditLimitCents); err != nil {
			continue
		}
		cards = append(cards, c)
	}
	return c.JSON(CardsResponse{Cards: cards})
}
