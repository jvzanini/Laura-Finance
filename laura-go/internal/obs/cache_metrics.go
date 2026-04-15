package obs

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	cachePubsubPublishes = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "laura_cache_pubsub_publishes_total",
		Help: "Total publishes no canal pub/sub de invalidação de cache, por tipo de pattern.",
	}, []string{"pattern_kind"})

	cachePubsubReceives = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "laura_cache_pubsub_receives_total",
		Help: "Total mensagens recebidas no canal pub/sub (outcome=applied|self|invalid|error).",
	}, []string{"outcome"})
)

// CachePubsubMetrics implementa cache.InvalidateMetrics.
type CachePubsubMetrics struct{}

func (CachePubsubMetrics) PubsubPublish(patternKind string) {
	cachePubsubPublishes.WithLabelValues(patternKind).Inc()
}

func (CachePubsubMetrics) PubsubReceive(outcome string) {
	cachePubsubReceives.WithLabelValues(outcome).Inc()
}

