package bootstrap

import (
	"log/slog"

	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
)

// InitLogger constrói o logger structured baseado no ambiente.
// Delega a obs.NewLoggerWithSentry (JSON em production, text em dev, com
// hook Sentry para captura automática de eventos >= WARN).
func InitLogger(env string) *slog.Logger {
	logger := obs.NewLoggerWithSentry(env)
	slog.SetDefault(logger)
	return logger
}
