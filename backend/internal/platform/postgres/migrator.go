package postgres

import (
	"errors"
	"fmt"
	"log/slog"

	"fuel-station-backend/db/migrations"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// RunMigrations applies all pending database migrations automatically.
func RunMigrations(databaseURL string, log *slog.Logger) error {
	driver, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("init iofs migrations: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", driver, databaseURL)
	if err != nil {
		return fmt.Errorf("init migrate instance: %w", err)
	}
	defer m.Close()

	// Check if the migration state is dirty. Dirty states MUST be resolved manually
	// by an engineer/DBA rather than automatically forcing clean, which can silently corrupt schemas.
	version, dirty, vErr := m.Version()
	if vErr == nil && dirty {
		return fmt.Errorf("database migration state is dirty at version %d: manual intervention required", version)
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}

	version, dirty, _ = m.Version()
	log.Info("database migrations applied successfully", "version", version, "dirty", dirty)
	return nil
}
