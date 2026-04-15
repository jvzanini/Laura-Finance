package obs

import (
	"context"
	"log/slog"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	pgxIdleConns = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "laura_pgxpool_idle_conns",
		Help: "Number of idle connections in pgxpool.",
	})
	pgxTotalConns = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "laura_pgxpool_total_conns",
		Help: "Total connections in pgxpool.",
	})
	pgxAcquireCount = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "laura_pgxpool_acquire_count",
		Help: "Cumulative count of connection acquires.",
	})
	pgxQueryDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "laura_pgxpool_query_duration_seconds",
		Help:    "Query duration histogram.",
		Buckets: prometheus.DefBuckets,
	})
	pgxErrorsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "laura_pgxpool_errors_total",
		Help: "Total errors per pgxpool operation type.",
	}, []string{"type"})

	llmCallDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "laura_llm_call_duration_seconds",
		Help:    "LLM call duration per provider/model.",
		Buckets: prometheus.DefBuckets,
	}, []string{"provider", "model"})
	llmCallErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "laura_llm_call_errors_total",
		Help: "LLM call error count per provider/reason.",
	}, []string{"provider", "reason"})
	llmTimeouts = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "laura_llm_timeouts_total",
		Help: "LLM timeouts per provider.",
	}, []string{"provider"})

	cronJobDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "laura_cron_job_duration_seconds",
		Help:    "Cron job duration per job.",
		Buckets: prometheus.DefBuckets,
	}, []string{"job"})

	backupLastSuccess = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "laura_backup_last_success_timestamp_seconds",
		Help: "Unix timestamp of last successful backup.",
	})
	backupLastSize = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "laura_backup_last_size_bytes",
		Help: "Size in bytes of last backup.",
	})
)

// StartPgxStatsCollector le pool.Stat() a cada 15s e atualiza gauges.
func StartPgxStatsCollector(ctx context.Context, pool *pgxpool.Pool) {
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if pool == nil {
					continue
				}
				stat := pool.Stat()
				pgxIdleConns.Set(float64(stat.IdleConns()))
				pgxTotalConns.Set(float64(stat.TotalConns()))
				pgxAcquireCount.Set(float64(stat.AcquireCount()))
			}
		}
	}()
}

// ObserveLLMCall instrumenta uma chamada LLM externa.
func ObserveLLMCall(provider, model string, duration time.Duration, err error) {
	llmCallDuration.WithLabelValues(provider, model).Observe(duration.Seconds())
	if err != nil {
		llmCallErrors.WithLabelValues(provider, "error").Inc()
	}
}

// ObserveBackupSuccess atualiza gauges de backup.
func ObserveBackupSuccess(sizeBytes int64) {
	backupLastSuccess.SetToCurrentTime()
	backupLastSize.Set(float64(sizeBytes))
}

// ObserveCronJob mede duracao de cron job.
func ObserveCronJob(job string, duration time.Duration) {
	cronJobDuration.WithLabelValues(job).Observe(duration.Seconds())
}

// ObservePgxError incrementa contador de erros pgxpool por tipo.
func ObservePgxError(opType string) {
	pgxErrorsTotal.WithLabelValues(opType).Inc()
}

// ObservePgxQueryDuration observa duracao de query pgxpool.
func ObservePgxQueryDuration(d time.Duration) {
	pgxQueryDuration.Observe(d.Seconds())
}

// ObserveLLMTimeout incrementa contador de timeouts LLM.
func ObserveLLMTimeout(provider string) {
	llmTimeouts.WithLabelValues(provider).Inc()
}

// StartPoolExhaustionMonitor checa a cada 30s se o pool está perto do limite.
// > 90% acquired → slog.Warn + sentry.CaptureMessage.
func StartPoolExhaustionMonitor(ctx context.Context, pool *pgxpool.Pool) {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if pool == nil {
					continue
				}
				stat := pool.Stat()
				total := stat.TotalConns()
				if total == 0 {
					continue
				}
				acquired := stat.AcquiredConns()
				ratio := float64(acquired) / float64(total)
				if ratio > 0.9 {
					slog.Warn("pgxpool_near_exhaustion", "ratio", ratio, "acquired", acquired, "total", total)
					sentry.CaptureMessage("pgxpool near exhaustion")
				}
			}
		}
	}()
}
