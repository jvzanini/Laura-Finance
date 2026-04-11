package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type MemberItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	PhoneNumber string `json:"phone_number"`
	Role        string `json:"role"`
}

type MembersResponse struct {
	Members []MemberItem `json:"members"`
}

// handleListMembers retorna os phones cadastrados no workspace
// (representação de "membros autorizados a interagir com a Laura via
// WhatsApp" — Epic 2.1).
func handleListMembers(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx := context.Background()
	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, phone_number, role
		 FROM phones
		 WHERE workspace_id = $1
		 ORDER BY created_at ASC`,
		sess.WorkspaceID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	items := []MemberItem{}
	for rows.Next() {
		var m MemberItem
		if err := rows.Scan(&m.ID, &m.Name, &m.PhoneNumber, &m.Role); err != nil {
			continue
		}
		items = append(items, m)
	}
	return c.JSON(MembersResponse{Members: items})
}
