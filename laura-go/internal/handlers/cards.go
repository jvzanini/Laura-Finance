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
