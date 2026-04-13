package handlers

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type GoalItem struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Description  *string    `json:"description"`
	Emoji        string     `json:"emoji"`
	TargetCents  int        `json:"target_cents"`
	CurrentCents int        `json:"current_cents"`
	Deadline     *time.Time `json:"deadline"`
	Color        string     `json:"color"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
}

type GoalsResponse struct {
	Goals []GoalItem `json:"goals"`
}

type CreateGoalRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Emoji       string  `json:"emoji"`
	TargetCents int     `json:"target_cents"`
	Deadline    *string `json:"deadline"` // YYYY-MM-DD
	Color       string  `json:"color"`
}

type CreateGoalResponse struct {
	ID      string `json:"id"`
	Success bool   `json:"success"`
}

func handleCreateGoal(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	var req CreateGoalRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nome é obrigatório")
	}
	if req.TargetCents <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "valor-alvo deve ser positivo")
	}
	if req.Emoji == "" {
		req.Emoji = "🎯"
	}
	if req.Color == "" {
		req.Color = "#8B5CF6"
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	var goalID string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO financial_goals (workspace_id, name, description, emoji, target_cents, deadline, color)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id`,
		sess.WorkspaceID, req.Name, req.Description, req.Emoji, req.TargetCents, req.Deadline, req.Color,
	).Scan(&goalID)
	if err != nil {
		log.Printf("[ERROR] handleCreateGoal: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.Status(fiber.StatusCreated).JSON(CreateGoalResponse{ID: goalID, Success: true})
}

// handleListGoals retorna os financial_goals do workspace logado
// ordenados por created_at desc. Equivalente ao fetchGoalsAction do PWA.
func handleListGoals(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
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
		log.Printf("[ERROR] handleListGoals: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
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
