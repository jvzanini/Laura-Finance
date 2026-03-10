package handlers

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/models"
)

func HandleWhatsappWebhook(c *fiber.Ctx) error {
	var payload models.WebhookPayload

	// 1. Parsing the incoming JSON
	if err := c.BodyParser(&payload); err != nil {
		log.Printf("[Webhook Error] Could not parse body: %v\n", err)
		return c.SendStatus(fiber.StatusBadRequest)
	}

	// 2. Ignore messages sent from the bot itself
	if payload.Data.Key.FromMe {
		return c.SendStatus(fiber.StatusOK)
	}

	// 3. Extract purely the phone number from remoteJID (e.g., 5511999999999@s.whatsapp.net -> 5511999999999)
	senderJID := payload.Data.Key.RemoteJid
	pieces := strings.Split(senderJID, "@")
	if len(pieces) < 1 {
		return c.SendStatus(fiber.StatusOK)
	}
	phoneNumber := strings.TrimSpace(pieces[0])

	// 4. Validate if this phone number exists in our PostgreSQL `phones` table
	if db.Pool != nil {
		var workspaceID string
		err := db.Pool.QueryRow(
			context.Background(),
			"SELECT workspace_id FROM phones WHERE phone_number = $1 LIMIT 1",
			phoneNumber,
		).Scan(&workspaceID)

		if err != nil {
			// If not found in DB, we completely ignore (unauthorized unknown sender)
			log.Printf("[Security] Ignored unknown sender: %s\n", phoneNumber)
			return c.SendStatus(fiber.StatusOK)
		}

		// 5. Fire AI processing pipeline in a Background Goroutine!
		// We respond with 200 OK fast so WhatsApp API doesn't timeout
		text := payload.Data.Message.Conversation
		log.Printf("[Gateway✓] Received from %s (Workspace: %s): %s\n", phoneNumber, workspaceID, text)

		go ProcessMessageFlow(workspaceID, phoneNumber, text)
	}

	return c.SendStatus(fiber.StatusOK)
}

// Background Task mock
func ProcessMessageFlow(workspaceID, phoneNumber, text string) {
	fmt.Printf("[Background Goroutine Started] Passing to Brain/LLM... [%s]\n", text)
	// Integration to Groq / NLP goes here in the next stories.
}
