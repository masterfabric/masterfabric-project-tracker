// Command migrate runs embedded PostgreSQL migrations using DATABASE_DSN (same as the server).
//
//	-up (default)   apply pending migrations
//	-down           roll back all migrations
//	-reset          down then up (same DB, empty schema + re-apply)
package main

import (
	"flag"
	"log/slog"
	"os"

	"github.com/joho/godotenv"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/migrations"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/logger"
)

func main() {
	_ = godotenv.Load()

	down := flag.Bool("down", false, "roll back all migrations (drop schema objects)")
	reset := flag.Bool("reset", false, "roll back all migrations, then apply up again")
	flag.Parse()

	cfg := config.Load()
	cfg.Validate()
	log := logger.New(cfg.Log.Level, cfg.Log.Format)

	if *reset {
		if err := migrations.Down(cfg.Database.DSN, log); err != nil {
			log.Error("migration down failed", slog.Any("error", err))
			os.Exit(1)
		}
		if err := migrations.Run(cfg.Database.DSN, log); err != nil {
			log.Error("migration up failed", slog.Any("error", err))
			os.Exit(1)
		}
		log.Info("database migrate reset complete (down + up)")
		return
	}

	if *down {
		if err := migrations.Down(cfg.Database.DSN, log); err != nil {
			log.Error("migration down failed", slog.Any("error", err))
			os.Exit(1)
		}
		log.Info("migrations rolled back")
		return
	}

	if err := migrations.Run(cfg.Database.DSN, log); err != nil {
		log.Error("migration failed", slog.Any("error", err))
		os.Exit(1)
	}
	log.Info("migrations finished successfully")
}
