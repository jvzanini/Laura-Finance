package main

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/gofiber/fiber/v2/utils"
)

func TestReadyHandler_200_Stub(t *testing.T) {
	app := fiber.New()
	app.Get("/ready", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ready", "db": "ok"})
	})
	req := httptest.NewRequest("GET", "/ready", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("esperava 200, veio %d", resp.StatusCode)
	}
}

func TestRequestIDMiddleware_AddsHeader(t *testing.T) {
	app := fiber.New()
	app.Use(requestid.New(requestid.Config{
		Header:     "X-Request-Id",
		Generator:  utils.UUIDv4,
		ContextKey: "requestid",
	}))
	app.Get("/ping", func(c *fiber.Ctx) error { return c.SendString("pong") })
	req := httptest.NewRequest("GET", "/ping", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if got := resp.Header.Get("X-Request-Id"); got == "" {
		t.Fatalf("esperava header X-Request-Id, veio vazio")
	}
}
