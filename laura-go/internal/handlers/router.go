package handlers

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/jvzanini/laura-finance/laura-go/internal/cache"
)

// RegisterRoutes monta todas as rotas do namespace /api/v1/* no Fiber
// app principal. É chamado uma vez do main.go após os middlewares
// globais (logger, recover, cors). Mantém main.go enxuto e os
// handlers organizados por domínio neste package.
//
// Convenção: toda rota sob /api/v1/* passa por RequireSession();
// rotas de admin adicionam RequireSuperAdmin() depois.
func RegisterRoutes(app *fiber.App) {
	// Rate limiting — antes de tudo. Max ajustável via env (útil em CI E2E
	// onde PWA dispara rajadas de server actions em paralelo).
	rateMax := 60
	if v := os.Getenv("RATE_LIMIT_MAX"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			rateMax = n
		}
	}
	app.Use(limiter.New(limiter.Config{
		Max:        rateMax,
		Expiration: 1 * time.Minute,
	}))

	// CORS allowing PWA to call from localhost:3100 with credentials
	app.Use(cors.New(cors.Config{
		AllowOrigins:     getCORSOrigins(),
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, Cookie",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// Security headers
	app.Use(func(c *fiber.Ctx) error {
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "DENY")
		c.Set("X-XSS-Protection", "1; mode=block")
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		return c.Next()
	})

	// Health (público) — fica no namespace pra unificar
	app.Get("/api/v1/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "laura-go"})
	})

	// Ops backup endpoint — autenticado via X-Ops-Token (fora do /api/v1)
	app.Post("/api/ops/backup", OpsBackupHandler)

	// Banking sync endpoint — autenticado via X-Ops-Token (ops-only).
	// Feature flag FEATURE_BANK_SYNC=off por default (STANDBY Fase 13).
	app.Post("/api/v1/banking/sync", handleBankingSync)

	// Pluggy webhook — público, autenticado via HMAC header.
	// Rate limit já aplicado pelo limiter global (60/min). Feature flag
	// FEATURE_PLUGGY_WEBHOOKS=true para habilitar.
	app.Post("/api/banking/webhooks/pluggy", handlePluggyWebhook)

	// ─── Rotas públicas (sem sessão) ───
	// Grupo com rate limit próprio mais agressivo (10/min por IP) para
	// proteger contra abuse de signup.
	publicLimiter := limiter.New(limiter.Config{
		Max:        10,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
	})
	publicGroup := app.Group("/api/v1/public")
	publicGroup.Get("/plans", handlePublicListPlans)
	publicGroup.Post("/signup/start", publicLimiter, handlePublicSignupStart)
	publicGroup.Post("/signup/verify-email", publicLimiter, handlePublicSignupVerifyEmail)
	publicGroup.Post("/signup/verify-whatsapp", publicLimiter, handlePublicSignupVerifyWhatsapp)
	publicGroup.Post("/signup/finalize", publicLimiter, handlePublicSignupFinalize)
	publicGroup.Post("/signup/resend-email", publicLimiter, handlePublicSignupResendEmail)
	publicGroup.Post("/signup/resend-whatsapp", publicLimiter, handlePublicSignupResendWhatsapp)

	// Endpoint dev-only para smoke test do Sentry (dispara panic capturado
	// pelo middleware sentryfiber + recover). Nao registra em producao.
	if os.Getenv("APP_ENV") != "production" {
		app.Post("/api/_debug/panic", func(c *fiber.Ctx) error {
			panic("smoke sentry test panic")
		})
	}

	// Rotas autenticadas — sem gating de assinatura (usuário sempre pode
	// ver /me, gerenciar perfil, consultar estado da assinatura etc).
	api := app.Group("/api/v1")
	api.Use(RequireSession())
	api.Get("/me", handleMe)
	api.Get("/me/subscription", handleMeSubscription)
	api.Put("/me/profile", handleUpdateProfile)
	api.Put("/me/settings", handleUpdateSettings)
	api.Put("/me/password", handleChangePassword)

	// Features gated pelo paywall — se subscription_status estiver
	// bloqueado, retorna 402 e orienta redirect para /subscription.
	feature := api.Group("", RequireActiveSubscription())
	feature.Get("/reports/dre", handleReportsDRE)
	feature.Get("/goals", handleListGoals)
	feature.Post("/goals", handleCreateGoal)
	feature.Get("/investments", handleListInvestments)
	feature.Post("/investments", handleCreateInvestment)
	feature.Get("/transactions", handleListTransactions)
	feature.Get("/cards", handleListCards)
	feature.Post("/cards", handleCreateCard)
	feature.Delete("/cards/:id", handleDeleteCard)
	feature.Delete("/transactions/:id", handleDeleteTransaction)
	feature.Put("/transactions/:id/category", handleUpdateTransactionCategory)
	feature.Get("/categories", handleListCategories)
	feature.Post("/categories", handleCreateCategory)
	feature.Post("/categories/seed", handleSeedCategories)
	feature.Get("/invoices", handleListInvoices)
	feature.Post("/invoices", handleCreateInvoice)
	feature.Post("/invoices/:id/pay", handleMarkInvoicePaid)
	feature.Get("/debt-rollovers", handleListDebtRollovers)
	feature.Post("/debt-rollovers", handleCreateDebtRollover)
	feature.Get("/members", handleListMembers)
	feature.Post("/members", handleCreateMember)
	feature.Delete("/members/:id", handleDeleteMember)
	feature.Get("/payment-processors", handleListPaymentProcessors)
	feature.Get("/score/current", handleCurrentScore)
	feature.Get("/score/history", handleScoreHistory)
	feature.Get("/reports/categories", handleReportCategories)
	feature.Get("/reports/subcategories", handleReportSubcategories)
	feature.Get("/reports/cards", handleReportCards)
	feature.Get("/reports/payment-methods", handleReportPaymentMethods)
	feature.Get("/reports/travel", handleReportTravel)
	feature.Get("/reports/comparative", handleReportComparative)
	feature.Get("/reports/trend", handleReportTrend)
	feature.Get("/reports/members", handleReportMembers)
	feature.Get("/dashboard/cashflow", handleCashFlow)
	feature.Get("/dashboard/upcoming-bills", handleUpcomingBills)
	feature.Get("/dashboard/category-budgets", handleCategoryBudgets)

	// Banking endpoints (Open Finance Foundation - Fase 13)
	// Stub: retorna lista vazia até integração Pluggy concluir (Fase 14).
	api.Get("/banking/accounts", func(c *fiber.Ctx) error {
		sess := getSession(c)
		if sess == nil {
			return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
		}
		key := fmt.Sprintf("ws:%s:banking:accounts", sess.WorkspaceID)
		result, _ := cache.GetOrCompute[[]any](c.Context(), Cache, key, 60*time.Second, func(ctx context.Context) ([]any, error) {
			return []any{}, nil
		})
		return c.JSON(fiber.Map{"accounts": result})
	})

	// Banking — Open Finance (Fase 13 foundation).
	api.Post("/banking/connect", handleBankingConnect)

	// Opções públicas (para selects do PWA — só ativos)
	api.Get("/options/banks", handlePublicOptions("bank_options", "sort_order, name"))
	api.Get("/options/card-brands", handlePublicOptions("card_brand_options", "sort_order, name"))
	api.Get("/options/brokers", handlePublicOptions("broker_options", "sort_order, name"))
	api.Get("/options/investment-types", handlePublicOptions("investment_type_options", "sort_order, name"))
	api.Get("/options/goal-templates", handlePublicOptions("goal_templates", "sort_order, name"))

	// Rotas admin — chain adicional
	admin := api.Group("/admin", RequireSuperAdmin())
	admin.Get("/overview", handleAdminOverview)

	// Config global
	admin.Get("/config", handleAdminListConfig)
	admin.Put("/config/:key", handleAdminUpdateConfig)

	// Planos de assinatura
	admin.Get("/plans", handleAdminListPlans)
	admin.Put("/plans/:slug", handleAdminUpdatePlan)

	// Payment processors
	admin.Get("/processors", handleAdminListProcessors)
	admin.Post("/processors", handleAdminCreateProcessor)
	admin.Put("/processors/:id", handleAdminUpdateProcessor)
	admin.Delete("/processors/:id", handleAdminDeleteProcessor)

	// Category templates
	admin.Get("/category-templates", handleAdminListCategoryTemplates)
	admin.Post("/category-templates", handleAdminCreateCategoryTemplate)
	admin.Put("/category-templates/:id", handleAdminUpdateCategoryTemplate)
	admin.Delete("/category-templates/:id", handleAdminDeleteCategoryTemplate)

	// Goal templates
	admin.Get("/goal-templates", handleAdminListOptions("goal_templates"))
	admin.Post("/goal-templates", handleAdminCreateOption("goal_templates", []string{"name"}))
	admin.Put("/goal-templates/:id", handleAdminToggleOption("goal_templates"))
	admin.Delete("/goal-templates/:id", handleAdminDeleteOption("goal_templates"))

	// Banks
	admin.Get("/banks", handleAdminListOptions("bank_options"))
	admin.Post("/banks", handleAdminCreateOption("bank_options", []string{"name", "slug"}))
	admin.Put("/banks/:id", handleAdminToggleOption("bank_options"))
	admin.Delete("/banks/:id", handleAdminDeleteOption("bank_options"))

	// Card brands
	admin.Get("/card-brands", handleAdminListOptions("card_brand_options"))
	admin.Post("/card-brands", handleAdminCreateOption("card_brand_options", []string{"name", "slug"}))
	admin.Put("/card-brands/:id", handleAdminToggleOption("card_brand_options"))
	admin.Delete("/card-brands/:id", handleAdminDeleteOption("card_brand_options"))

	// Brokers
	admin.Get("/brokers", handleAdminListOptions("broker_options"))
	admin.Post("/brokers", handleAdminCreateOption("broker_options", []string{"name", "slug"}))
	admin.Put("/brokers/:id", handleAdminToggleOption("broker_options"))
	admin.Delete("/brokers/:id", handleAdminDeleteOption("broker_options"))

	// Investment types
	admin.Get("/investment-types", handleAdminListOptions("investment_type_options"))
	admin.Post("/investment-types", handleAdminCreateOption("investment_type_options", []string{"name", "slug"}))
	admin.Put("/investment-types/:id", handleAdminToggleOption("investment_type_options"))
	admin.Delete("/investment-types/:id", handleAdminDeleteOption("investment_type_options"))

	// Workspaces
	admin.Get("/workspaces", handleAdminListWorkspaces)
	admin.Put("/workspaces/:id/suspend", handleAdminSuspendWorkspace)
	admin.Put("/workspaces/:id/reactivate", handleAdminReactivateWorkspace)

	// Audit log
	admin.Get("/audit-log", handleAdminListAuditLog)

	// WhatsApp instances
	admin.Get("/whatsapp/instances", handleAdminListWhatsAppInstances)
	admin.Post("/whatsapp/instances", handleAdminCreateWhatsAppInstance)
	admin.Post("/whatsapp/instances/:id/connect", handleAdminConnectWhatsAppInstance)
	admin.Post("/whatsapp/instances/:id/disconnect", handleAdminDisconnectWhatsAppInstance)
	admin.Get("/whatsapp/instances/:id/qr", handleAdminGetQRCode)
	admin.Delete("/whatsapp/instances/:id", handleAdminDeleteWhatsAppInstance)
}

// getCORSOrigins retorna a lista de origens permitidas via env var
// CORS_ORIGINS (comma-separated). Fallback para localhost em dev.
func getCORSOrigins() string {
	if origins := os.Getenv("CORS_ORIGINS"); origins != "" {
		return origins
	}
	return "http://localhost:3100,http://127.0.0.1:3100"
}
