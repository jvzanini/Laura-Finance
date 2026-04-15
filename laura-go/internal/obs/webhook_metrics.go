package obs

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	PluggyWebhookReceived = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "laura_pluggy_webhook_received_total",
		Help: "Total de webhooks Pluggy recebidos (accepted|dedupe|invalid|unauthorized|unknown_item).",
	}, []string{"event", "outcome"})

	PluggyWebhookProcessed = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "laura_pluggy_webhook_processed_total",
		Help: "Total de eventos Pluggy processados pelo worker (success|error|skipped|dead_letter).",
	}, []string{"event", "outcome"})

	PluggyWebhookQueueDepth = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "laura_pluggy_webhook_queue_depth",
		Help: "Número de eventos Pluggy não processados (processed_at IS NULL).",
	})
)
