package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type MeResponse struct {
	ID             string     `json:"id"`
	Name           string     `json:"name"`
	Email          string     `json:"email"`
	Role           string     `json:"role"`
	WorkspaceID    string     `json:"workspace_id"`
	WorkspaceName  string     `json:"workspace_name"`
	PhoneNumber    *string    `json:"phone_number"`
	EmailVerified  bool       `json:"email_verified"`
	IsSuperAdmin   bool       `json:"is_super_admin"`
	CreatedAt      *time.Time `json:"created_at,omitempty"`
}

// handleMe retorna o perfil do usuário logado. Equivalente ao
// fetchUserProfileAction do PWA, mas acessível via REST.
func handleMe(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx := context.Background()
	var resp MeResponse
	var phone *string
	var createdAt time.Time
	err := db.Pool.QueryRow(ctx,
		`SELECT u.id, u.name, u.email, u.role, u.workspace_id, w.name AS workspace_name,
		        u.phone_number, u.email_verified, COALESCE(u.is_super_admin, FALSE), u.created_at
		 FROM users u
		 JOIN workspaces w ON w.id = u.workspace_id
		 WHERE u.id = $1
		 LIMIT 1`,
		sess.UserID,
	).Scan(
		&resp.ID, &resp.Name, &resp.Email, &resp.Role, &resp.WorkspaceID, &resp.WorkspaceName,
		&phone, &resp.EmailVerified, &resp.IsSuperAdmin, &createdAt,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "usuário não encontrado")
	}
	resp.PhoneNumber = phone
	resp.CreatedAt = &createdAt
	return c.JSON(resp)
}
