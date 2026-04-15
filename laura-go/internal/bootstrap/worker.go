package bootstrap

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jvzanini/laura-finance/laura-go/internal/banking"
)

// StartWebhookWorker inicia o worker do Pluggy em goroutine.
// syncFunc é injetado pelo caller (main.go).
func StartWebhookWorker(ctx context.Context, pool *pgxpool.Pool, syncFunc func(ctx context.Context, workspaceID string) error) {
	if pool == nil {
		slog.Warn("pluggy_worker_skipped_no_pool")
		return
	}
	w := banking.NewWebhookWorker(pool, syncFunc)
	go func() {
		if err := w.Run(ctx); err != nil {
			slog.Error("pluggy_worker_exited", "err", err)
		}
	}()
}
