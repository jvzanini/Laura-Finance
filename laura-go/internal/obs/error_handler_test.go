package obs

import (
	"context"
	"errors"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

func TestClassifyError_FiberError(t *testing.T) {
	cases := []struct {
		fc       int
		wantCode string
	}{
		{400, CodeValidationFailed},
		{401, CodeAuthInvalidCredentials},
		{403, CodeForbidden},
		{404, CodeNotFound},
		{409, CodeConflict},
		{429, CodeRateLimited},
	}
	for _, tc := range cases {
		c, s := classifyError(fiber.NewError(tc.fc))
		if c != tc.wantCode || s != tc.fc {
			t.Errorf("fiber %d: code=%s status=%d", tc.fc, c, s)
		}
	}
}

func TestClassifyError_DeadlineExceeded(t *testing.T) {
	c, s := classifyError(context.DeadlineExceeded)
	if c != CodeDBTimeout || s != 504 {
		t.Errorf("got %s/%d", c, s)
	}
}

func TestClassifyError_PgxNoRows(t *testing.T) {
	c, s := classifyError(pgx.ErrNoRows)
	if c != CodeNotFound || s != 404 {
		t.Errorf("got %s/%d", c, s)
	}
}

func TestClassifyError_Unknown(t *testing.T) {
	c, s := classifyError(errors.New("unknown"))
	if c != CodeInternal || s != 500 {
		t.Errorf("got %s/%d", c, s)
	}
}
