package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type GoalItem struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Description   *string    `json:"description"`
	Emoji         string     `json:"emoji"`
	TargetCents   int        `json:"target_cents"`
	CurrentCents  int        `json:"current_cents"`
	Deadline      *time.Time `json:"deadline"`
	Color         string     `json:"color"`
	Status        string     `json:"status"`
	CreatedAt     time.Time  `json:"created_at"`
}

type GoalsResponse struct {
	Goals []GoalItem `json:"goals"`
}

// handleListGoals retorna os financial_goals do workspace logado
// ordenados por created_at desc. Equivalente ao fetchGoalsAction do PWA.
func handleListGoals(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx := context.Background()
	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, description, COALESCE(emoji, '🎯'), target_cents,
		        COALESCE(current_cents, 0), deadline, COALESCE(color, '#8B5CF6'),
		        COALESCE(status, 'active'), created_at
		 FROM financial_goals
		 WHERE workspace_id = $1
		 ORDER BY created_at DESC`,
		sess.WorkspaceID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	goals := []GoalItem{}
	for rows.Next() {
		var g GoalItem
		if err := rows.Scan(
			&g.ID, &g.Name, &g.Description, &g.Emoji, &g.TargetCents,
			&g.CurrentCents, &g.Deadline, &g.Color, &g.Status, &g.CreatedAt,
		); err != nil {
			continue
		}
		goals = append(goals, g)
	}
	return c.JSON(GoalsResponse{Goals: goals})
}
