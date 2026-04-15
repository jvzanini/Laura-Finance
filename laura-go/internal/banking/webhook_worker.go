// Package banking implementa o worker assíncrono que processa
// eventos Pluggy recebidos via webhook.
package banking

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
)

const (
	pollInterval = 30 * time.Second
	batchSize    = 50
	maxRetries   = 5
)

// WebhookWorker consome a fila bank_webhook_events e despacha
// eventos Pluggy para os respectivos handlers (ex: sync após
// item/updated).
type WebhookWorker struct {
	pool     *pgxpool.Pool
	syncFunc func(ctx context.Context, workspaceID string) error
}

// NewWebhookWorker cria worker. syncFunc é injetada para evitar
// dependência circular handlers↔banking.
func NewWebhookWorker(pool *pgxpool.Pool, syncFunc func(ctx context.Context, workspaceID string) error) *WebhookWorker {
	return &WebhookWorker{pool: pool, syncFunc: syncFunc}
}

// Run dispara loop de polling. Retorna quando ctx é cancelado.
// No-op (log + sleep) se FEATURE_PLUGGY_WEBHOOKS != "true".
func (w *WebhookWorker) Run(ctx context.Context) error {
	slog.Info("pluggy_webhook_worker_starting", "poll_interval", pollInterval)
	t := time.NewTicker(pollInterval)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("pluggy_webhook_worker_stopped")
			return nil
		case <-t.C:
			if os.Getenv("FEATURE_PLUGGY_WEBHOOKS") != "true" {
				continue
			}
			w.tick(ctx)
		}
	}
}

// RunOnce executa uma única iteração do polling. Útil para testes.
func (w *WebhookWorker) RunOnce(ctx context.Context) {
	w.tick(ctx)
}

func (w *WebhookWorker) tick(ctx context.Context) {
	w.updateQueueDepth(ctx)

	rows, err := w.pool.Query(ctx, `
		SELECT id::text, COALESCE(workspace_id::text, ''), event_type, item_id, retry_count
		FROM bank_webhook_events
		WHERE processed_at IS NULL AND retry_count < $1
		ORDER BY received_at
		LIMIT $2
		FOR UPDATE SKIP LOCKED
	`, maxRetries, batchSize)
	if err != nil {
		slog.ErrorContext(ctx, "pluggy_worker_query_failed", "err", err)
		return
	}
	defer rows.Close()

	type job struct {
		id          string
		workspaceID string
		event       string
		itemID      string
		retryCount  int
	}
	var jobs []job
	for rows.Next() {
		var j job
		if err := rows.Scan(&j.id, &j.workspaceID, &j.event, &j.itemID, &j.retryCount); err != nil {
			slog.ErrorContext(ctx, "pluggy_worker_scan_failed", "err", err)
			continue
		}
		jobs = append(jobs, j)
	}

	for _, j := range jobs {
		w.process(ctx, j.id, j.workspaceID, j.event, j.itemID, j.retryCount)
	}
}

func (w *WebhookWorker) process(ctx context.Context, id, workspaceID, event, itemID string, retryCount int) {
	// Advisory lock por item — evita workers diferentes processarem
	// eventos do mesmo item em paralelo.
	var locked bool
	if err := w.pool.QueryRow(ctx, `SELECT pg_try_advisory_xact_lock(hashtext($1))`, itemID).Scan(&locked); err != nil {
		slog.WarnContext(ctx, "pluggy_worker_lock_failed", "err", err)
		return
	}
	if !locked {
		obs.PluggyWebhookProcessed.WithLabelValues(event, "skipped").Inc()
		return
	}

	if workspaceID != "" {
		// Ativa RLS por workspace dentro desta transação/conn.
		if _, err := w.pool.Exec(ctx, `SELECT set_config('app.workspace_id', $1, true)`, workspaceID); err != nil {
			slog.WarnContext(ctx, "pluggy_worker_set_rls_failed", "err", err)
		}
	}

	err := w.dispatch(ctx, event, workspaceID)
	if err != nil {
		w.onError(ctx, id, event, err, retryCount)
		return
	}

	if _, uerr := w.pool.Exec(ctx, `UPDATE bank_webhook_events SET processed_at = NOW(), error_message = NULL WHERE id = $1::uuid`, id); uerr != nil {
		slog.ErrorContext(ctx, "pluggy_worker_mark_processed_failed", "err", uerr)
	}
	obs.PluggyWebhookProcessed.WithLabelValues(event, "success").Inc()
}

func (w *WebhookWorker) dispatch(ctx context.Context, event, workspaceID string) error {
	switch event {
	case "item/updated", "transactions/created", "transactions/updated":
		if workspaceID == "" {
			return errors.New("missing workspace_id for sync")
		}
		if w.syncFunc == nil {
			return errors.New("sync function not configured")
		}
		return w.syncFunc(ctx, workspaceID)
	case "item/error":
		slog.ErrorContext(ctx, "pluggy_item_error_event", "workspace_id", workspaceID)
		return nil
	default:
		slog.InfoContext(ctx, "pluggy_webhook_noop_event", "event", event)
		return nil
	}
}

func (w *WebhookWorker) onError(ctx context.Context, id, event string, dispatchErr error, retryCount int) {
	newCount := retryCount + 1
	msg := dispatchErr.Error()
	if newCount >= maxRetries {
		if _, uerr := w.pool.Exec(ctx, `UPDATE bank_webhook_events SET processed_at = NOW(), retry_count = $1, error_message = $2 WHERE id = $3::uuid`, newCount, msg, id); uerr != nil {
			slog.ErrorContext(ctx, "pluggy_worker_dead_letter_failed", "err", uerr)
		}
		obs.PluggyWebhookProcessed.WithLabelValues(event, "dead_letter").Inc()
		slog.WarnContext(ctx, "pluggy_worker_dead_letter", "id", id, "event", event, "last_err", msg)
		return
	}
	if _, uerr := w.pool.Exec(ctx, `UPDATE bank_webhook_events SET retry_count = $1, error_message = $2 WHERE id = $3::uuid`, newCount, msg, id); uerr != nil {
		slog.ErrorContext(ctx, "pluggy_worker_retry_update_failed", "err", uerr)
	}
	obs.PluggyWebhookProcessed.WithLabelValues(event, "error").Inc()
}

func (w *WebhookWorker) updateQueueDepth(ctx context.Context) {
	var n int
	err := w.pool.QueryRow(ctx, `SELECT COUNT(*) FROM bank_webhook_events WHERE processed_at IS NULL`).Scan(&n)
	if err != nil {
		return
	}
	obs.PluggyWebhookQueueDepth.Set(float64(n))
}

// ErrNotImplemented sinaliza falha do dispatch por falta de código.
var ErrNotImplemented = errors.New("not implemented")

// dummyErrPgxNoRows silences unused import.
var _ = pgx.ErrNoRows
