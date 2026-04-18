// Package migrations embeds SQL migration files and provides a helper to run
// them against a PostgreSQL database using golang-migrate.
package migrations

import (
	"embed"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5" // pgx5 driver
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// latestVersion is the highest migration number (must match highest 00X_*.sql file).
const latestVersion = 9

//go:embed *.sql
var sqlFiles embed.FS

// Run applies all pending UP migrations embedded in this package.
// dsn must be a postgres:// or pgx5:// connection string.
// It is idempotent: already-applied migrations produce no error.
func Run(dsn string, log *slog.Logger) error {
	src, err := iofs.New(sqlFiles, ".")
	if err != nil {
		return fmt.Errorf("migrations: create iofs source: %w", err)
	}

	// golang-migrate's pgx/v5 driver is registered under the "pgx5" scheme.
	// Rewrite postgres:// → pgx5:// so the correct driver is selected.
	pgx5DSN := "pgx5" + dsn[len("postgres"):]

	m, err := migrate.NewWithSourceInstance("iofs", src, pgx5DSN)
	if err != nil {
		return fmt.Errorf("migrations: create migrator: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		errStr := err.Error()
		// Recover from dirty database (interrupted migration)
		if strings.Contains(errStr, "Dirty database") {
			// Force to latest to mark schema as complete; app can then start
			log.Warn("dirty database detected, forcing to latest version and retrying", slog.Int("version", latestVersion))
			if forceErr := m.Force(latestVersion); forceErr != nil {
				return fmt.Errorf("migrations: force (dirty recovery): %w", forceErr)
			}
			if retryErr := m.Up(); retryErr != nil && !errors.Is(retryErr, migrate.ErrNoChange) {
				return fmt.Errorf("migrations: up (after dirty recovery): %w", retryErr)
			}
		} else if strings.Contains(errStr, "no migration found for version") {
			// Recover from stale schema_version (e.g. DB from different branch/project)
			log.Warn("schema_version mismatch, forcing to latest and retrying", slog.Int("version", latestVersion))
			if forceErr := m.Force(latestVersion); forceErr != nil {
				return fmt.Errorf("migrations: force: %w", forceErr)
			}
			if retryErr := m.Up(); retryErr != nil && !errors.Is(retryErr, migrate.ErrNoChange) {
				return fmt.Errorf("migrations: up (after force): %w", retryErr)
			}
		} else {
			return fmt.Errorf("migrations: up: %w", err)
		}
	}

	version, dirty, _ := m.Version()
	log.Info("migrations applied", slog.Uint64("version", uint64(version)), slog.Bool("dirty", dirty))
	return nil
}

// Down rolls back all embedded DOWN migrations (drops tables / columns in reverse order).
func Down(dsn string, log *slog.Logger) error {
	src, err := iofs.New(sqlFiles, ".")
	if err != nil {
		return fmt.Errorf("migrations: create iofs source: %w", err)
	}

	pgx5DSN := "pgx5" + dsn[len("postgres"):]

	m, err := migrate.NewWithSourceInstance("iofs", src, pgx5DSN)
	if err != nil {
		return fmt.Errorf("migrations: create migrator: %w", err)
	}
	defer m.Close()

	if err := m.Down(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrations: down: %w", err)
	}

	version, dirty, _ := m.Version()
	log.Info("migrations rolled back", slog.Uint64("version", uint64(version)), slog.Bool("dirty", dirty))
	return nil
}
