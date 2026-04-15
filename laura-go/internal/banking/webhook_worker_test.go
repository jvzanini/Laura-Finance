//go:build integration

package banking_test

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jvzanini/laura-finance/laura-go/internal/banking"
	"github.com/jvzanini/laura-finance/laura-go/internal/bootstrap"
	"github.com/jvzanini/laura-finance/laura-go/internal/testutil"
)

func newTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := testutil.SharedDSN
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	if dsn == "" {
		t.Skip("sem DSN")
	}
	if err := bootstrap.RunMigrations(dsn); err != nil {
		t.Fatalf("migrations: %v", err)
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func seedWorkspace(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO workspaces (name) VALUES ('test-wh')
		RETURNING id::text`).Scan(&id)
	if err != nil {
		t.Fatalf("seed ws: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM workspaces WHERE id = $1::uuid", id)
	})
	return id
}

func insertEvent(t *testing.T, pool *pgxpool.Pool, workspaceID, event, itemID, hash string) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO bank_webhook_events
			(workspace_id, event_type, item_id, payload_hash, payload, signature)
		VALUES (NULLIF($1,'')::uuid, $2, $3, $4, '{}'::jsonb, 'sha256=x')
		RETURNING id::text`,
		workspaceID, event, itemID, hash).Scan(&id)
	if err != nil {
		t.Fatalf("insert event: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM bank_webhook_events WHERE id = $1::uuid", id)
	})
	return id
}

func getProcessed(t *testing.T, pool *pgxpool.Pool, id string) (bool, int, *string) {
	t.Helper()
	var processed bool
	var retry int
	var msg *string
	err := pool.QueryRow(context.Background(), `
		SELECT processed_at IS NOT NULL, retry_count, error_message
		FROM bank_webhook_events WHERE id = $1::uuid`, id).Scan(&processed, &retry, &msg)
	if err != nil {
		t.Fatalf("select: %v", err)
	}
	return processed, retry, msg
}

func TestWorker_DispatchUpdated_CallsSync(t *testing.T) {
	pool := newTestPool(t)
	t.Setenv("FEATURE_PLUGGY_WEBHOOKS", "true")
	wsID := seedWorkspace(t, pool)
	id := insertEvent(t, pool, wsID, "item/updated", "item-abc", "hash-upd-1")

	called := false
	w := banking.NewWebhookWorker(pool, func(ctx context.Context, workspaceID string) error {
		called = true
		if workspaceID != wsID {
			t.Errorf("workspace_id mismatch: got %s want %s", workspaceID, wsID)
		}
		return nil
	})

	w.RunOnce(context.Background())

	if !called {
		t.Fatal("syncFunc não foi chamada")
	}
	processed, _, _ := getProcessed(t, pool, id)
	if !processed {
		t.Error("evento deveria estar marcado como processed")
	}
}

func TestWorker_UnknownEvent_MarkedProcessed(t *testing.T) {
	pool := newTestPool(t)
	t.Setenv("FEATURE_PLUGGY_WEBHOOKS", "true")
	id := insertEvent(t, pool, "", "noop/event", "item-noop", "hash-noop-1")

	w := banking.NewWebhookWorker(pool, nil)
	w.RunOnce(context.Background())

	processed, retry, _ := getProcessed(t, pool, id)
	if !processed || retry != 0 {
		t.Errorf("esperava processed=true retry=0, got processed=%v retry=%d", processed, retry)
	}
}

func TestWorker_DispatchError_RetryIncrement(t *testing.T) {
	pool := newTestPool(t)
	t.Setenv("FEATURE_PLUGGY_WEBHOOKS", "true")
	wsID := seedWorkspace(t, pool)
	id := insertEvent(t, pool, wsID, "item/updated", "item-err", "hash-err-1")

	w := banking.NewWebhookWorker(pool, func(ctx context.Context, _ string) error {
		return errors.New("boom")
	})

	w.RunOnce(context.Background())

	processed, retry, msg := getProcessed(t, pool, id)
	if processed {
		t.Error("não deveria processar após erro (retry<5)")
	}
	if retry != 1 {
		t.Errorf("retry=%d want 1", retry)
	}
	if msg == nil || *msg != "boom" {
		t.Errorf("error_message = %v", msg)
	}
}

func TestWorker_DeadLetter_After5(t *testing.T) {
	pool := newTestPool(t)
	t.Setenv("FEATURE_PLUGGY_WEBHOOKS", "true")
	wsID := seedWorkspace(t, pool)
	id := insertEvent(t, pool, wsID, "item/updated", "item-dl", "hash-dl-1")
	// bump retry_count para 4 — próximo erro vira dead-letter.
	_, _ = pool.Exec(context.Background(),
		`UPDATE bank_webhook_events SET retry_count = 4 WHERE id = $1::uuid`, id)

	w := banking.NewWebhookWorker(pool, func(ctx context.Context, _ string) error {
		return errors.New("permanent")
	})
	w.RunOnce(context.Background())

	processed, retry, _ := getProcessed(t, pool, id)
	if !processed || retry != 5 {
		t.Errorf("esperava dead-letter processed=true retry=5, got processed=%v retry=%d", processed, retry)
	}
}
