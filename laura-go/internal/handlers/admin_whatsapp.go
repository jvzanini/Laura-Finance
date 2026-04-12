package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/whatsapp"
)

type InstanceResponse struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	PhoneNumber string  `json:"phone_number"`
	Status      string  `json:"status"`
	WebhookURL  *string `json:"webhook_url"`
}

func handleAdminListWhatsAppInstances(c *fiber.Ctx) error {
	ctx := context.Background()
	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, COALESCE(phone_number, ''), status, webhook_url
		 FROM whatsapp_instances ORDER BY created_at`)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	items := []InstanceResponse{}
	for rows.Next() {
		var inst InstanceResponse
		if err := rows.Scan(&inst.ID, &inst.Name, &inst.PhoneNumber, &inst.Status, &inst.WebhookURL); err != nil {
			continue
		}
		// Atualizar status real do InstanceManager
		if managed := whatsapp.Manager.GetInstance(inst.ID); managed != nil {
			inst.Status = managed.Status
			if managed.PhoneNumber != "" {
				inst.PhoneNumber = managed.PhoneNumber
			}
		}
		items = append(items, inst)
	}
	return c.JSON(fiber.Map{"instances": items})
}

func handleAdminCreateWhatsAppInstance(c *fiber.Ctx) error {
	var body struct {
		Name       string `json:"name"`
		WebhookURL string `json:"webhook_url"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if body.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nome é obrigatório")
	}

	ctx := context.Background()
	var id string
	err := db.Pool.QueryRow(ctx,
		"INSERT INTO whatsapp_instances (name, webhook_url) VALUES ($1, $2) RETURNING id",
		body.Name, nilIfEmpty(body.WebhookURL),
	).Scan(&id)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	whatsapp.Manager.CreateInstance(id, body.Name)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "success": true})
}

func handleAdminConnectWhatsAppInstance(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := whatsapp.Manager.ConnectInstance(id); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"success": true})
}

func handleAdminDisconnectWhatsAppInstance(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := whatsapp.Manager.DisconnectInstance(id); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"success": true})
}

func handleAdminGetQRCode(c *fiber.Ctx) error {
	id := c.Params("id")
	qr, err := whatsapp.Manager.GetQRCode(id)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, err.Error())
	}
	return c.JSON(fiber.Map{"qr_code": qr})
}

func handleAdminDeleteWhatsAppInstance(c *fiber.Ctx) error {
	id := c.Params("id")
	whatsapp.Manager.RemoveInstance(id)

	ctx := context.Background()
	db.Pool.Exec(ctx, "DELETE FROM whatsapp_instances WHERE id = $1", id)

	return c.JSON(fiber.Map{"success": true})
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
