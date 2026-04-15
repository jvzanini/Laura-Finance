package obs

import (
	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"
)

// NewMetricsApp cria um app Fiber separado dedicado a expor /metrics
// na porta 9090. Retorna tambem o middleware Prometheus que deve ser
// aplicado no app principal para instrumentar as rotas HTTP.
func NewMetricsApp() (*fiber.App, *fiberprometheus.FiberPrometheus) {
	metricsApp := fiber.New(fiber.Config{DisableStartupMessage: true})
	prom := fiberprometheus.New("laura_api")
	prom.RegisterAt(metricsApp, "/metrics")
	return metricsApp, prom
}
