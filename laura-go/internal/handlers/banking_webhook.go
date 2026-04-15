//go:build sprintE_wip

// banking_webhook.go é parte do Sprint E (Pluggy webhooks) e ainda
// depende de APIs que serão introduzidas lá (db.GetDB etc). Build tag
// temporária evita quebrar os demais sprints.
package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/pluggy"
)

const (
	maxWebhookBodyBytes = 64 * 1024 // 64KB
	webhookSigHeader    = "X-Pluggy-Signature"
)

// pluggyWebhookPayload é a estrutura mínima que precisamos do body
// para roteamento. Campos específicos de cada evento ficam em
// payload JSONB para flexibilidade.
type pluggyWebhookPayload struct {
	Event  string `json:"event"`
	ItemID string `json:"itemId"`
}

// handlePluggyWebhook recebe POST do Pluggy, valida HMAC, dedupe
// por (item_id, event, payload_hash) e insere em bank_webhook_events
// para processamento assíncrono pelo worker.
//
// Rota pública (sem requireSession). Rate limit deve ser aplicado
// via middleware na rota.
func handlePluggyWebhook(c *fiber.Ctx) error {
	if os.Getenv("FEATURE_PLUGGY_WEBHOOKS") != "true" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "pluggy webhooks disabled",
		})
	}

	body := c.Body()
	if len(body) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "empty body"})
	}
	if len(body) > maxWebhookBodyBytes {
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": "body too large"})
	}

	secrets := []string{
		os.Getenv("PLUGGY_WEBHOOK_SECRET"),
		os.Getenv("PLUGGY_WEBHOOK_SECRET_OLD"),
	}
	sig := c.Get(webhookSigHeader)
	if !pluggy.VerifySignature(body, sig, secrets) {
		slog.WarnContext(c.UserContext(), "pluggy_webhook_unauthorized", "sig_header", sig != "")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid signature"})
	}

	var payload pluggyWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid json"})
	}
	if payload.Event == "" || payload.ItemID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing event or itemId"})
	}

	ctx := c.UserContext()
	pool := db.Pool
	if pool == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db unavailable"})
	}

	var workspaceID *string
	var wsID string
	err := pool.QueryRow(ctx,
		`SELECT workspace_id::text FROM bank_accounts WHERE item_id = $1 LIMIT 1`,
		payload.ItemID,
	).Scan(&wsID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			slog.WarnContext(ctx, "pluggy_webhook_unknown_item", "item_id", payload.ItemID)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "item not linked"})
		}
		slog.ErrorContext(ctx, "pluggy_webhook_lookup_failed", "err", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal"})
	}
	workspaceID = &wsID

	hash := sha256.Sum256(body)
	payloadHash := hex.EncodeToString(hash[:])

	_, err = pool.Exec(ctx, `
		INSERT INTO bank_webhook_events
			(workspace_id, event_type, item_id, payload_hash, payload, signature)
		VALUES ($1::uuid, $2, $3, $4, $5, $6)
		ON CONFLICT (item_id, event_type, payload_hash) DO NOTHING
	`, workspaceID, payload.Event, payload.ItemID, payloadHash, body, sig)
	if err != nil {
		slog.ErrorContext(ctx, "pluggy_webhook_insert_failed", "err", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "insert failed"})
	}

	slog.InfoContext(ctx, "pluggy_webhook_accepted",
		"event", payload.Event,
		"item_id", payload.ItemID,
		"workspace_id", wsID,
	)
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"status": "accepted"})
}
