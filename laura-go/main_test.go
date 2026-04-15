package main

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/gofiber/fiber/v2/utils"
)

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
