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

	// Check if the migration state is dirty from a previous interrupted run
	version, dirty, vErr := m.Version()
	if vErr == nil && dirty {
		log.Warn("database migration state is dirty, forcing clean version before upgrade", "version", version)
		if forceErr := m.Force(int(version)); forceErr != nil {
			log.Error("failed to force migration version", "err", forceErr)
		}
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		// If dirty occurred during upgrade, attempt recovery once
		if v, d, errV := m.Version(); errV == nil && d {
			log.Warn("retrying migration after forcing version", "version", v)
			_ = m.Force(int(v))
			if retryErr := m.Up(); retryErr != nil && !errors.Is(retryErr, migrate.ErrNoChange) {
				return fmt.Errorf("apply migrations after dirty recovery: %w", retryErr)
			}
		} else {
			return fmt.Errorf("apply migrations: %w", err)
		}
	}

	version, dirty, _ = m.Version()
	log.Info("database migrations applied successfully", "version", version, "dirty", dirty)
	return nil
}
