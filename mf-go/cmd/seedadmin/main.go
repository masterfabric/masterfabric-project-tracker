// Command seedadmin upserts an admin user (bcrypt password, role admin). For local/bootstrap only.
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/auth"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/logger"
)

func main() {
	_ = godotenv.Load()

	email := flag.String("email", "dev@masterfabric.co", "admin user email")
	displayName := flag.String("display-name", "Dev Admin", "display name when creating the user")
	flag.Parse()

	password := strings.TrimSpace(os.Getenv("SEED_ADMIN_PASSWORD"))
	if password == "" {
		fmt.Fprintln(os.Stderr, "seedadmin: set SEED_ADMIN_PASSWORD in the environment (do not commit it)")
		os.Exit(1)
	}

	emailNorm := strings.TrimSpace(strings.ToLower(*email))
	display := strings.TrimSpace(*displayName)

	cfg := config.Load()
	cfg.Validate()
	log := logger.New(cfg.Log.Level, cfg.Log.Format)

	hash, err := auth.HashPassword(password)
	if err != nil {
		log.Error("hash password", slog.Any("error", err))
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.Database.DSN)
	if err != nil {
		log.Error("database connect", slog.Any("error", err))
		os.Exit(1)
	}
	defer pool.Close()

	id := uuid.New()
	now := time.Now().UTC()

	const q = `
INSERT INTO users (id, email, password_hash, display_name, nickname, avatar_url, bio, status, role, created_at, updated_at)
VALUES ($1, $2, $3, $4, '', '', '', 'active', 'admin', $5, $5)
ON CONFLICT (email) DO UPDATE SET
	password_hash = EXCLUDED.password_hash,
	role = 'admin',
	status = 'active',
	display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name),
	updated_at = EXCLUDED.updated_at`

	tag, err := pool.Exec(ctx, q, id, emailNorm, hash, display, now)
	if err != nil {
		log.Error("upsert admin user", slog.Any("error", err))
		os.Exit(1)
	}

	log.Info("admin user ready", slog.String("email", emailNorm), slog.Int64("rows_affected", tag.RowsAffected()))
}
