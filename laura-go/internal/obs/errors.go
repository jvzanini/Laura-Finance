package obs

import (
	"log/slog"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/gofiber/fiber/v2"
)

// ErrorBody é o shape canônico do campo "error" nas respostas JSON.
// Clients podem mapear por Code (estável) e exibir Message (PT-BR).
type ErrorBody struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id"`
	Timestamp string `json:"timestamp"`
}

// RespondError envia resposta JSON no shape canônico:
//
//	{ "error": { "code", "message", "request_id", "timestamp" } }
//
// Regras:
//   - Mensagem derivada do código (PT-BR, sem vazar detalhes sensíveis).
//   - request_id lido de c.Locals("requestid") — propagado pelo middleware.
//   - Timestamp em RFC3339 UTC.
//   - 5xx → slog.Error + sentry.CaptureException (NoOp seguro se Sentry não init).
//   - 4xx → slog.Warn, sem Sentry.
//   - O "err" original entra no log como campo (nunca no body exposto ao cliente).
func RespondError(c *fiber.Ctx, code string, status int, err error) error {
	requestID, _ := c.Locals("requestid").(string)

	body := ErrorBody{
		Code:      code,
		Message:   messageFor(code),
		RequestID: requestID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	logger, _ := c.Locals("logger").(*slog.Logger)
	if logger == nil {
		logger = slog.Default()
	}

	attrs := []any{
		"error_code", code,
		"status", status,
		"path", c.Path(),
		"method", c.Method(),
	}
	if err != nil {
		attrs = append(attrs, "err", err.Error())
	}

	if status >= 500 {
		logger.Error("request_error", attrs...)
		if err != nil {
			sentry.CaptureException(err)
		}
	} else {
		logger.Warn("request_error", attrs...)
	}

	return c.Status(status).JSON(fiber.Map{"error": body})
}
