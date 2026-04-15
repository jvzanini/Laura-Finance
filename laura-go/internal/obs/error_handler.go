package obs

import (
	"context"
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

// GlobalErrorHandler é o ErrorHandler global do Fiber. Classifica o erro
// em um código canônico + HTTP status e delega ao RespondError para shape JSON.
func GlobalErrorHandler(c *fiber.Ctx, err error) error {
	code, status := classifyError(err)
	return RespondError(c, code, status, err)
}

// classifyError mapeia erros em (código canônico, HTTP status).
// - *fiber.Error  → por código HTTP.
// - context.DeadlineExceeded → DB_TIMEOUT / 504.
// - pgx.ErrNoRows → NOT_FOUND / 404.
// - qualquer outro → INTERNAL / 500.
func classifyError(err error) (string, int) {
	var fe *fiber.Error
	if errors.As(err, &fe) {
		switch fe.Code {
		case 400:
			return CodeValidationFailed, 400
		case 401:
			return CodeAuthInvalidCredentials, 401
		case 403:
			return CodeForbidden, 403
		case 404:
			return CodeNotFound, 404
		case 409:
			return CodeConflict, 409
		case 429:
			return CodeRateLimited, 429
		}
		return CodeInternal, fe.Code
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return CodeDBTimeout, 504
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return CodeNotFound, 404
	}
	return CodeInternal, 500
}
