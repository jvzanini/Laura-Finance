package obs

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// criticalRoutes — unico lugar onde label de cardinalidade alta
// (workspace_id) eh permitido. Os 5 endpoints canonicos de negocio.
var criticalRoutes = map[string]bool{
	"/api/v1/transactions":            true,
	"/api/v1/dashboard":               true,
	"/api/v1/score":                   true,
	"/api/v1/reports":                 true,
	"/api/v1/auth/login":              true,
	"/api/v1/reports/dre":             true,
	"/api/v1/reports/categories":      true,
	"/api/v1/reports/subcategories":   true,
	"/api/v1/reports/cards":           true,
	"/api/v1/reports/payment-methods": true,
	"/api/v1/reports/travel":          true,
	"/api/v1/reports/comparative":     true,
	"/api/v1/reports/trend":           true,
	"/api/v1/reports/members":         true,
}

var workspaceHTTP = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name:    "laura_http_workspace_request_duration_seconds",
	Help:    "HTTP request duration per workspace in 5 critical routes.",
	Buckets: prometheus.DefBuckets,
}, []string{"workspace_id", "route", "status"})

// WorkspaceLabelMiddleware observa apenas rotas criticas. Nas demais
// rotas, cardinalidade fica contida pela metrica padrao fiberprometheus.
func WorkspaceLabelMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !criticalRoutes[c.Path()] {
			return c.Next()
		}
		start := time.Now()
		err := c.Next()
		ws, _ := c.Locals("workspace_id").(string)
		if ws == "" {
			ws = "unknown"
		}
		workspaceHTTP.
			WithLabelValues(ws, c.Path(), strconv.Itoa(c.Response().StatusCode())).
			Observe(time.Since(start).Seconds())
		return err
	}
}
