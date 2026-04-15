package services

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/jackc/pgx/v5"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	webhookSecretConfigKey = "pluggy_webhook_secret_set_at"
	webhookWarnAgeDays     = 85
	webhookErrorAgeDays    = 89
)

var webhookSecretAgeGauge = promauto.NewGauge(prometheus.GaugeOpts{
	Name: "laura_webhook_secret_age_days",
	Help: "Idade em dias da PLUGGY_WEBHOOK_SECRET (lido de system_config).",
})

// CheckWebhookSecretAge consulta system_config, calcula idade do
// secret e alerta se ultrapassar thresholds. Retorna age em dias
// (ou -1 se ausente).
func CheckWebhookSecretAge(ctx context.Context) int {
	if db.Pool == nil {
		return -1
	}
	var setAt time.Time
	err := db.Pool.QueryRow(ctx,
		`SELECT value::timestamptz FROM system_config WHERE key = $1`,
		webhookSecretConfigKey,
	).Scan(&setAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			slog.InfoContext(ctx, "webhook_secret_age_unknown",
				"reason", "system_config key ausente — seed via SeedWebhookSecretSetAt")
			webhookSecretAgeGauge.Set(-1)
			return -1
		}
		slog.ErrorContext(ctx, "webhook_secret_age_query_failed", "err", err)
		return -1
	}

	age := int(time.Since(setAt).Hours() / 24)
	webhookSecretAgeGauge.Set(float64(age))

	switch {
	case age > webhookErrorAgeDays:
		slog.ErrorContext(ctx, "webhook_secret_age_critical",
			"age_days", age, "threshold", webhookErrorAgeDays)
		sentry.CaptureMessage("PLUGGY_WEBHOOK_SECRET idade > 89d — rotacionar urgente")
	case age > webhookWarnAgeDays:
		slog.WarnContext(ctx, "webhook_secret_age_warning",
			"age_days", age, "threshold", webhookWarnAgeDays)
		sentry.CaptureMessage("PLUGGY_WEBHOOK_SECRET idade > 85d — planejar rotação")
	default:
		slog.InfoContext(ctx, "webhook_secret_age_ok", "age_days", age)
	}
	return age
}

// SeedWebhookSecretSetAt insere timestamp agora se a key não existe.
// Idempotente — chamado em boot para ter baseline.
func SeedWebhookSecretSetAt(ctx context.Context) error {
	if db.Pool == nil {
		return nil
	}
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO system_config (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO NOTHING
	`, webhookSecretConfigKey, time.Now().UTC().Format(time.RFC3339))
	return err
}
