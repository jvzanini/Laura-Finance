//go:build !sprintE_wip

// Stub de handlePluggyWebhook utilizado enquanto o Sprint E não é
// mergeado. Retorna 503 (feature flag desligada por padrão) para não
// bloquear build dos demais sprints. Este arquivo é substituído pelo
// handler real quando a build tag `sprintE_wip` é ativada.
package handlers

import "github.com/gofiber/fiber/v2"

func handlePluggyWebhook(c *fiber.Ctx) error {
	return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
		"error":   "pluggy webhooks not enabled",
		"standby": "FEATURE_PLUGGY_WEBHOOKS",
	})
}
