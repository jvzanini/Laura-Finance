package services

import (
	"context"
	"log/slog"
	"time"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/robfig/cron/v3"
	"go.opentelemetry.io/otel"
)

// StartTrialLifecycleCron agenda o job diário que:
//   1. Marca workspaces com trial expirado como 'expired' e envia email.
//   2. Envia avisos D-3 e D-1 para workspaces em trial.
//   3. Move past_due para expired quando grace_until passou.
func StartTrialLifecycleCron() {
	c := cron.New()
	// 04:00 UTC diário — alinhado ao job de webhook secret age existente.
	_, err := c.AddFunc("0 4 * * *", func() {
		_, span := otel.Tracer("laura/cron").Start(context.Background(), "cron.run_trial_lifecycle")
		defer span.End()
		slog.Info("[CRON] running trial lifecycle check")
		runTrialLifecycle()
	})
	if err != nil {
		slog.Error("[CRON] falha ao configurar trial lifecycle cron", "err", err)
		return
	}
	c.Start()
	slog.Info("[CRON] trial lifecycle cron started (04:00 UTC daily)")
}

func runTrialLifecycle() {
	if db.Pool == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// 1) Trial expirado → marca como expired + envia email.
	rows, err := db.Pool.Query(ctx,
		`UPDATE workspaces
		 SET subscription_status = 'expired'
		 WHERE subscription_status = 'trial' AND trial_ends_at < CURRENT_TIMESTAMP
		 RETURNING id`)
	if err != nil {
		slog.ErrorContext(ctx, "cron_trial_expired_update", "err", err)
	} else {
		expiredIDs := []string{}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err == nil {
				expiredIDs = append(expiredIDs, id)
			}
		}
		rows.Close()
		for _, id := range expiredIDs {
			notifyWorkspace(ctx, id, "trial_expired")
		}
	}

	// 2) Avisos D-3 e D-1.
	notifyTrialDayWarn(ctx, 3)
	notifyTrialDayWarn(ctx, 1)

	// 3) past_due → expired quando grace expirou.
	_, err = db.Pool.Exec(ctx,
		`UPDATE workspaces
		 SET subscription_status = 'expired'
		 WHERE subscription_status = 'past_due'
		   AND past_due_grace_until IS NOT NULL
		   AND past_due_grace_until < CURRENT_TIMESTAMP`)
	if err != nil {
		slog.ErrorContext(ctx, "cron_past_due_expire", "err", err)
	}
}

// notifyTrialDayWarn dispara email para workspaces cujo trial termina
// em exatamente `days` dias (± janela de 2h).
func notifyTrialDayWarn(ctx context.Context, days int) {
	rows, err := db.Pool.Query(ctx,
		`SELECT w.id FROM workspaces w
		 WHERE w.subscription_status = 'trial'
		   AND w.trial_ends_at BETWEEN CURRENT_TIMESTAMP + make_interval(days => $1) - INTERVAL '2 hours'
		                           AND CURRENT_TIMESTAMP + make_interval(days => $1) + INTERVAL '2 hours'`,
		days,
	)
	if err != nil {
		slog.ErrorContext(ctx, "cron_trial_day_warn_query", "err", err, "days", days)
		return
	}
	defer rows.Close()

	var event string
	if days == 1 {
		event = "trial_ending_d1"
	} else {
		event = "trial_ending_d3"
	}

	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			notifyWorkspace(ctx, id, event)
		}
	}
}

// notifyWorkspace busca o owner do workspace e dispara o email
// apropriado. Best-effort.
func notifyWorkspace(ctx context.Context, workspaceID, event string) {
	var email, name string
	var plan *string
	err := db.Pool.QueryRow(ctx,
		`SELECT u.email, u.name, w.current_plan_slug
		 FROM users u
		 JOIN workspaces w ON w.id = u.workspace_id
		 WHERE w.id = $1 AND u.role = 'proprietário'
		 LIMIT 1`,
		workspaceID,
	).Scan(&email, &name, &plan)
	if err != nil {
		slog.WarnContext(ctx, "cron_notify_lookup_owner_failed", "err", err, "workspace", workspaceID)
		return
	}
	planName := "VIP"
	if plan != nil && *plan != "" {
		planName = *plan
	}

	var sendErr error
	switch event {
	case "trial_expired":
		sendErr = SendTrialExpiredEmail(ctx, email, name)
	case "trial_ending_d3":
		sendErr = SendTrialEndingEmail(ctx, email, name, 3)
	case "trial_ending_d1":
		sendErr = SendTrialEndingEmail(ctx, email, name, 1)
	}
	if sendErr != nil {
		slog.WarnContext(ctx, "cron_notify_email_failed", "err", sendErr, "workspace", workspaceID, "event", event)
	}
	_ = planName // reservado para uso futuro em templates dinâmicos
}
