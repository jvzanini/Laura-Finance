package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/handlers"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
	"github.com/jvzanini/laura-finance/laura-go/internal/whatsapp"
)

func main() {
	// Load environment variables (mostly for local development)
	_ = godotenv.Load(".env")

	// Initialize PostgreSQL Connection
	if err := db.ConnectDB(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.CloseDB()
	log.Println("Database connection established!")

	// Initialize Fiber
	app := fiber.New(fiber.Config{
		DisableStartupMessage: false,
	})

	app.Use(logger.New())
	app.Use(recover.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendString("Laura Finance Go API is healthy!")
	})

	// Registra o namespace /api/v1/* com session middleware + CORS.
	// Mantém /api/whatsapp/validate existente em paralelo até migração
	// gradual para /api/v1/*.
	handlers.RegisterRoutes(app)

	app.Post("/api/whatsapp/validate", func(c *fiber.Ctx) error {
		type ValidateReq struct {
			Phone string `json:"phone"`
		}
		var req ValidateReq
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}
		jid, err := whatsapp.ValidateWhatsAppNumber(req.Phone)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"jid": jid})
	})

	// Start WhatsApp Client
	if os.Getenv("DISABLE_WHATSAPP") == "true" {
		log.Printf("DISABLE_WHATSAPP=true -- main pulou whatsapp init")
	} else {
		log.Println("Starting Whatsmeow Client...")
		whatsapp.InitWhatsmeow()
	}

	// Start AI/Budget Cron Tasks
	services.StartBudgetAlertCron(whatsapp.SendTextMessage)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting Laura Go Server on port %s...", port)

	go func() {
		if err := app.Listen(":" + port); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Graceful Shutdown to preserve WhatsApp Persistent Connection (crucial for Whatsmeow)
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	log.Println("\n[System] Gracefully shutting down...")
	if whatsapp.Client != nil {
		whatsapp.Client.Disconnect()
	}
	log.Println("[WhatsApp] Successfully disconnected.")
}
