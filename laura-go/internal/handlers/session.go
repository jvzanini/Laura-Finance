package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// SessionCookieName deve bater com o nome usado no PWA em src/lib/session.ts.
const SessionCookieName = "laura_session_token"

// sessionPayload corresponde ao shape que o PWA grava no cookie via
// Buffer.from(JSON.stringify({userId, exp})).toString('base64').
// O Go decodifica o mesmo formato — compartilhando o cookie, PWA e API
// rodam autenticados pelo mesmo mecanismo sem duplicar lógica.
//
// Nota: esse é um mock-JWT (sem assinatura) criado no Epic 1.2 do PWA.
// Quando a Story 1.2 migrar para JWT real assinado, este decoder também
// precisa ser atualizado.
type sessionPayload struct {
	UserID string `json:"userId"`
	Exp    int64  `json:"exp"` // unix milliseconds
}

// SessionContext é o payload enriquecido que o middleware guarda em
// ctx.Locals("session") depois de validar e expandir via DB lookup.
type SessionContext struct {
	UserID        string
	WorkspaceID   string
	Email         string
	Name          string
	Role          string
	IsSuperAdmin  bool
}

// decodeSessionCookie lê o raw base64 do cookie e devolve o payload
// estruturado. Retorna erro amigável se o shape for inválido ou expirado.
func decodeSessionCookie(raw string) (*sessionPayload, error) {
	if raw == "" {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "cookie de sessão ausente")
	}
	decoded, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "cookie de sessão mal-formado")
	}
	var payload sessionPayload
	if err := json.Unmarshal(decoded, &payload); err != nil {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "payload de sessão inválido")
	}
	if payload.UserID == "" {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "sessão sem userId")
	}
	if payload.Exp > 0 && payload.Exp < time.Now().UnixMilli() {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "sessão expirada")
	}
	return &payload, nil
}

// RequireSession é o middleware que deve ser usado em toda rota
// /api/v1/*. Lê o cookie, decodifica, busca os dados do user no banco
// e guarda o SessionContext em ctx.Locals("session").
func RequireSession() fiber.Handler {
	return func(c *fiber.Ctx) error {
		raw := c.Cookies(SessionCookieName)
		payload, err := decodeSessionCookie(raw)
		if err != nil {
			return err
		}

		if db.Pool == nil {
			return fiber.NewError(fiber.StatusInternalServerError, "banco não inicializado")
		}

		ctx := context.Background()
		var sess SessionContext
		err = db.Pool.QueryRow(ctx,
			`SELECT id, workspace_id, email, name, role, COALESCE(is_super_admin, FALSE)
			 FROM users WHERE id = $1 LIMIT 1`,
			payload.UserID,
		).Scan(&sess.UserID, &sess.WorkspaceID, &sess.Email, &sess.Name, &sess.Role, &sess.IsSuperAdmin)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "usuário da sessão não encontrado")
		}

		c.Locals("session", &sess)
		return c.Next()
	}
}

// RequireSuperAdmin deve ser chainado DEPOIS de RequireSession. Falha
// com 403 se o user logado não tem is_super_admin.
func RequireSuperAdmin() fiber.Handler {
	return func(c *fiber.Ctx) error {
		sess, ok := c.Locals("session").(*SessionContext)
		if !ok || sess == nil {
			return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
		}
		if !sess.IsSuperAdmin {
			return fiber.NewError(fiber.StatusForbidden, "acesso restrito a super admins")
		}
		return c.Next()
	}
}

// getSession extrai a sessão do ctx.Locals — helper para os handlers.
func getSession(c *fiber.Ctx) *SessionContext {
	sess, _ := c.Locals("session").(*SessionContext)
	return sess
}
