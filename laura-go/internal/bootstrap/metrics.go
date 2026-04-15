package bootstrap

import (
	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"

	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
)

// MetricsResources agrupa o app Fiber separado para servir /metrics
// e o middleware Prometheus a ser aplicado no app principal.
type MetricsResources struct {
	App        *fiber.App
	Prometheus *fiberprometheus.FiberPrometheus
}

// InitMetrics constrói o app Fiber separado para /metrics e retorna
// também o middleware Prometheus que deve ser registrado no app principal.
func InitMetrics() (*MetricsResources, error) {
	app, prom := obs.NewMetricsApp()
	return &MetricsResources{App: app, Prometheus: prom}, nil
}
