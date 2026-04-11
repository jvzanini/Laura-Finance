package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// RegisterRoutes monta todas as rotas do namespace /api/v1/* no Fiber
// app principal. É chamado uma vez do main.go após os middlewares
// globais (logger, recover, cors). Mantém main.go enxuto e os
// handlers organizados por domínio neste package.
//
// Convenção: toda rota sob /api/v1/* passa por RequireSession();
// rotas de admin adicionam RequireSuperAdmin() depois.
func RegisterRoutes(app *fiber.App) {
	// CORS allowing PWA to call from localhost:3100 with credentials
	app.Use(cors.New(cors.Config{
		AllowOrigins:     getCORSOrigins(),
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, Cookie",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// Health (público) — fica no namespace pra unificar
	app.Get("/api/v1/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "laura-go"})
	})

	// Rotas autenticadas
	api := app.Group("/api/v1")
	api.Use(RequireSession())
	api.Get("/me", handleMe)
	api.Get("/reports/dre", handleReportsDRE)
	api.Get("/goals", handleListGoals)
	api.Get("/investments", handleListInvestments)
	api.Get("/transactions", handleListTransactions)
	api.Get("/cards", handleListCards)
	api.Get("/categories", handleListCategories)
	api.Get("/dashboard/cashflow", handleCashFlow)
	api.Get("/dashboard/upcoming-bills", handleUpcomingBills)
	api.Get("/dashboard/category-budgets", handleCategoryBudgets)

	// Rotas admin — chain adicional
	admin := api.Group("/admin", RequireSuperAdmin())
	admin.Get("/overview", handleAdminOverview)
}

// getCORSOrigins retorna a lista de origens permitidas. Em dev
// permite localhost:3100 (PWA). Em produção, usa CORS_ORIGINS env
// (comma-separated) ou wildcard restritivo.
func getCORSOrigins() string {
	// Poderíamos ler de env, mas pra manter simples no skeleton
	// inicial, hardcoded com os hosts de dev + prod placeholder.
	return "http://localhost:3100,http://127.0.0.1:3100,https://laura.nexus.ai"
}
