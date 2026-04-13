package handlers

import (
	"context"
	"log"
	"net/mail"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

type MeResponse struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Email         string     `json:"email"`
	Role          string     `json:"role"`
	WorkspaceID   string     `json:"workspace_id"`
	WorkspaceName string     `json:"workspace_name"`
	PhoneNumber   *string    `json:"phone_number"`
	EmailVerified bool       `json:"email_verified"`
	IsSuperAdmin  bool       `json:"is_super_admin"`
	CreatedAt     *time.Time `json:"created_at,omitempty"`
}

// handleMe retorna o perfil do usuário logado. Equivalente ao
// fetchUserProfileAction do PWA, mas acessível via REST.
func handleMe(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
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

type UpdateProfileRequest struct {
	Name        string `json:"name"`
	Email       string `json:"email"`
	PhoneNumber string `json:"phone_number"`
}

func handleUpdateProfile(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	var req UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if req.Name == "" || req.Email == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nome e email são obrigatórios")
	}

	// Validação de formato de email
	if _, err := mail.ParseAddress(req.Email); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "formato de email inválido")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	var existing int
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*)::int FROM users WHERE email = $1 AND id != $2", req.Email, sess.UserID).Scan(&existing)
	if existing > 0 {
		return fiber.NewError(fiber.StatusConflict, "email já em uso por outro usuário")
	}

	_, err := db.Pool.Exec(ctx,
		"UPDATE users SET name = $1, email = $2, phone_number = $3 WHERE id = $4",
		req.Name, req.Email, req.PhoneNumber, sess.UserID,
	)
	if err != nil {
		log.Printf("[ERROR] handleUpdateProfile: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(fiber.Map{"success": true})
}

type UpdateSettingsRequest struct {
	Settings map[string]interface{} `json:"settings"`
}

func handleUpdateSettings(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	var req UpdateSettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	settingsJSON := mustMarshalJSON(req.Settings)
	_, err := db.Pool.Exec(ctx,
		"UPDATE users SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb WHERE id = $2",
		string(settingsJSON), sess.UserID,
	)
	if err != nil {
		log.Printf("[ERROR] handleUpdateSettings: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(fiber.Map{"success": true})
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func handleChangePassword(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	var req ChangePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		return fiber.NewError(fiber.StatusBadRequest, "senhas são obrigatórias")
	}
	if len(req.NewPassword) < 8 {
		return fiber.NewError(fiber.StatusBadRequest, "nova senha deve ter no mínimo 8 caracteres")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	var storedHash string
	err := db.Pool.QueryRow(ctx, "SELECT password_hash FROM users WHERE id = $1", sess.UserID).Scan(&storedHash)
	if err != nil {
		log.Printf("[ERROR] handleChangePassword: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}

	if !checkPasswordHash(req.CurrentPassword, storedHash) {
		return fiber.NewError(fiber.StatusForbidden, "senha atual incorreta")
	}

	newHash, err := hashPassword(req.NewPassword)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "erro ao gerar hash")
	}

	_, err = db.Pool.Exec(ctx, "UPDATE users SET password_hash = $1 WHERE id = $2", newHash, sess.UserID)
	if err != nil {
		log.Printf("[ERROR] handleChangePassword (update): %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(fiber.Map{"success": true})
}
