package handlers

import (
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/pluggy"
)

// pluggyClient é criado lazy no primeiro acesso (permite testes
// setarem env vars com t.Setenv antes da primeira chamada).
var pluggyClient *pluggy.Client

func getPluggyClient() *pluggy.Client {
	if pluggyClient == nil {
		pluggyClient = pluggy.NewClient()
	}
	return pluggyClient
}

// resetPluggyClient força reinicialização (usado em testes).
func resetPluggyClient() {
	pluggyClient = nil
}

// handleBankingConnect gera connect_token para o Pluggy Widget.
// Retorna 501 se PLUGGY_CLIENT_ID/SECRET não estão configurados.
func handleBankingConnect(c *fiber.Ctx) error {
	client := pluggy.NewClient() // novo a cada request — respeita env atual
	if !client.IsConfigured() {
		return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{
			"error":   "Pluggy not configured",
			"standby": []string{"PLUGGY_CLIENT_ID", "PLUGGY_CLIENT_SECRET"},
		})
	}
	token, err := client.CreateConnectToken(c.UserContext())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"connect_token": token,
		"expires_in":    1800,
	})
}

// handleBankingSync dispara sync de contas/transações. Autenticado
// via X-Ops-Token (mesmo pattern de /api/ops/backup). Respeita
// feature flag FEATURE_BANK_SYNC (default off).
func handleBankingSync(c *fiber.Ctx) error {
	expected := os.Getenv("BACKUP_OPS_TOKEN")
	if expected == "" || c.Get("X-Ops-Token") != expected {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	if os.Getenv("FEATURE_BANK_SYNC") != "on" {
		return c.JSON(fiber.Map{
			"status":           "disabled",
			"synced_accounts":  0,
			"feature_flag":     "FEATURE_BANK_SYNC=off",
		})
	}
	// Fase 14: iterar sobre bank_accounts e chamar client.FetchTransactions.
	return c.JSON(fiber.Map{
		"status":          "stub",
		"synced_accounts": 0,
	})
}
