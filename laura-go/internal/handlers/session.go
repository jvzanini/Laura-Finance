package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// SessionCookieName deve bater com o nome usado no PWA em src/lib/session.ts.
const SessionCookieName = "laura_session_token"

// sessionPayload corresponde ao shape que o PWA grava no cookie via
// Buffer.from(JSON.stringify({userId, exp})).toString('base64').
type sessionPayload struct {
	UserID string `json:"userId"`
	Exp    int64  `json:"exp"` // unix milliseconds
}

// SessionContext é o payload enriquecido que o middleware guarda em
// ctx.Locals("session") depois de validar e expandir via DB lookup.
type SessionContext struct {
	UserID       string
	WorkspaceID  string
	Email        string
	Name         string
	Role         string
	IsSuperAdmin bool
}

// getSessionSecret retorna o segredo usado para HMAC-SHA256 dos cookies.
func getSessionSecret() string {
	secret := os.Getenv("SESSION_SECRET")
	if secret != "" {
		return secret
	}
	if os.Getenv("APP_ENV") == "production" {
		log.Fatal("SESSION_SECRET obrigatória em produção")
	}
	return "laura-dev-session-secret-change-me"
}

// decodeSessionCookie lê o cookie no formato base64payload.base64hmac,
// verifica o HMAC-SHA256 e devolve o payload estruturado.
func decodeSessionCookie(raw string) (*sessionPayload, error) {
	if raw == "" {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "cookie de sessão ausente")
	}

	parts := strings.SplitN(raw, ".", 2)
	if len(parts) != 2 {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "cookie de sessão mal-formado")
	}

	payloadB64 := parts[0]
	sigB64 := parts[1]

	// Verificar HMAC-SHA256
	sig, err := base64.StdEncoding.DecodeString(sigB64)
	if err != nil {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "assinatura de sessão inválida")
	}

	mac := hmac.New(sha256.New, []byte(getSessionSecret()))
	mac.Write([]byte(payloadB64))
	expectedMAC := mac.Sum(nil)

	if !hmac.Equal(sig, expectedMAC) {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "assinatura de sessão inválida")
	}

	decoded, err := base64.StdEncoding.DecodeString(payloadB64)
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

		ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
		defer cancel()

		var sess SessionContext
		err = db.Pool.QueryRow(ctx,
			`SELECT u.id, u.workspace_id, u.email, u.name, u.role, COALESCE(u.is_super_admin, FALSE)
			 FROM users u
			 JOIN workspaces w ON w.id = u.workspace_id AND w.suspended_at IS NULL
			 WHERE u.id = $1 LIMIT 1`,
			payload.UserID,
		).Scan(&sess.UserID, &sess.WorkspaceID, &sess.Email, &sess.Name, &sess.Role, &sess.IsSuperAdmin)
		if err != nil {
			return fiber.NewError(fiber.StatusForbidden, "workspace suspenso ou usuário não encontrado")
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

// signSessionCookie gera o cookie no formato base64payload.base64hmac.
func signSessionCookie(payload []byte) string {
	payloadB64 := base64.StdEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(getSessionSecret()))
	mac.Write([]byte(payloadB64))
	sigB64 := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return fmt.Sprintf("%s.%s", payloadB64, sigB64)
}
