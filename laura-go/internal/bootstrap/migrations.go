package bootstrap

import (
	"errors"
	"log/slog"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"

	"github.com/jvzanini/laura-finance/laura-go/internal/migrations"
)

// RunMigrations aplica migrations pendentes contra o DSN fornecido.
// NoOp silenciosa quando já está up-to-date (migrate.ErrNoChange).
func RunMigrations(dbURL string) error {
	src, err := migrations.Source()
	if err != nil {
		return err
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, dbURL)
	if err != nil {
		return err
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}
	v, dirty, _ := m.Version()
	slog.Info("migrations aplicadas", "version", v, "dirty", dirty)
	return nil
}
