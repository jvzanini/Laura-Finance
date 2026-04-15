package bootstrap

import (
	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
)

// InitSentry inicializa Sentry SDK e retorna função de flush.
// DSN vazio (SENTRY_DSN_API ausente) → NoOp.
func InitSentry(cfg Config) (flush func(), err error) {
	release := cfg.BuildVersion
	if release == "" {
		release = "dev"
	}
	flush = obs.InitSentry(release)
	return flush, nil
}
