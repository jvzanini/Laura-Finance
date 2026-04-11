package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
)

type PaymentProcessorItem struct {
	Slug string             `json:"slug"`
	Name string             `json:"name"`
	Fees map[string]float64 `json:"fees"`
}

type PaymentProcessorsResponse struct {
	Processors []PaymentProcessorItem `json:"processors"`
}

// handleListPaymentProcessors retorna a lista de adquirentes com suas
// taxas — reuse do services.LoadFeeTable (cache 5min, paridade com
// rollover.go). Público no sentido de workspace-agnostic mas ainda
// gated por sessão para consistência.
func handleListPaymentProcessors(c *fiber.Ctx) error {
	table := services.LoadFeeTable(c.Context())
	items := make([]PaymentProcessorItem, 0, len(table))
	for slug, p := range table {
		items = append(items, PaymentProcessorItem{
			Slug: slug,
			Name: p.Name,
			Fees: p.Fees,
		})
	}
	return c.JSON(PaymentProcessorsResponse{Processors: items})
}
