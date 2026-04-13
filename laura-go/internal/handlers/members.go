package handlers

import (
	"context"
	"log"
	"time"

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

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, phone_number, role
		 FROM phones
		 WHERE workspace_id = $1
		 ORDER BY created_at ASC`,
		sess.WorkspaceID,
	)
	if err != nil {
		log.Printf("[ERROR] handleListMembers: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
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

type CreateMemberRequest struct {
	Name        string `json:"name"`
	PhoneNumber string `json:"phone_number"`
	Role        string `json:"role"`
}

type CreateMemberResponse struct {
	ID      string `json:"id"`
	Success bool   `json:"success"`
}

func handleCreateMember(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	var req CreateMemberRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if req.Name == "" || req.PhoneNumber == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nome e telefone são obrigatórios")
	}
	if req.Role == "" {
		req.Role = "membro"
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	var existing int
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*)::int FROM phones WHERE phone_number = $1 AND workspace_id = $2", req.PhoneNumber, sess.WorkspaceID).Scan(&existing)
	if existing > 0 {
		return fiber.NewError(fiber.StatusConflict, "telefone já cadastrado")
	}

	var phoneID string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO phones (workspace_id, name, phone_number, role)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		sess.WorkspaceID, req.Name, req.PhoneNumber, req.Role,
	).Scan(&phoneID)
	if err != nil {
		log.Printf("[ERROR] handleCreateMember: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.Status(fiber.StatusCreated).JSON(CreateMemberResponse{ID: phoneID, Success: true})
}

func handleDeleteMember(c *fiber.Ctx) error {
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
		"DELETE FROM phones WHERE id = $1 AND workspace_id = $2",
		id, sess.WorkspaceID,
	)
	if err != nil {
		log.Printf("[ERROR] handleDeleteMember: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	if tag.RowsAffected() == 0 {
		return fiber.NewError(fiber.StatusNotFound, "membro não encontrado")
	}
	return c.JSON(fiber.Map{"success": true})
}
