package productrelease

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	prd "github.com/masterfabric/masterfabric_go_basic/internal/domain/productrelease"
)

// Repo is the PostgreSQL implementation of domain.Repository.
type Repo struct {
	db *pgxpool.Pool
}

// NewRepo constructs a Repo.
func NewRepo(db *pgxpool.Pool) *Repo {
	return &Repo{db: db}
}

var _ prd.Repository = (*Repo)(nil)

const sqlGet = `
SELECT pr.version, pr.changelog_markdown, pr.updated_at, pr.updated_by_user_id,
       COALESCE(u.display_name, '') AS updater_display
FROM product_release pr
LEFT JOIN users u ON u.id = pr.updated_by_user_id
WHERE pr.id = 1`

const sqlUpdate = `
UPDATE product_release
SET version = $1, changelog_markdown = $2, updated_at = NOW(), updated_by_user_id = $3
WHERE id = 1
RETURNING version, changelog_markdown, updated_at, updated_by_user_id`

// Get returns the single product release row.
func (r *Repo) Get(ctx context.Context) (*prd.ProductRelease, error) {
	row := r.db.QueryRow(ctx, sqlGet)
	var (
		version, changelog string
		updatedAt          time.Time
		updatedBy          *uuid.UUID
		updaterDisplay     string
	)
	if err := row.Scan(&version, &changelog, &updatedAt, &updatedBy, &updaterDisplay); err != nil {
		return nil, fmt.Errorf("productrelease get: %w", err)
	}
	return &prd.ProductRelease{
		Version:              version,
		ChangelogMarkdown:    changelog,
		UpdatedAt:            updatedAt,
		UpdatedByUserID:      updatedBy,
		UpdatedByDisplayName: updaterDisplay,
	}, nil
}

// Update sets version and changelog and returns the refreshed row.
func (r *Repo) Update(ctx context.Context, version, changelogMarkdown string, updatedByUserID *uuid.UUID) (*prd.ProductRelease, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("productrelease update begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		v, cm string
		ua    time.Time
		ub    *uuid.UUID
	)
	if err := tx.QueryRow(ctx, sqlUpdate, version, changelogMarkdown, updatedByUserID).Scan(&v, &cm, &ua, &ub); err != nil {
		return nil, fmt.Errorf("productrelease update: %w", err)
	}

	updaterDisplay := ""
	if updatedByUserID != nil {
		_ = tx.QueryRow(ctx, `SELECT COALESCE(display_name, '') FROM users WHERE id = $1`, updatedByUserID).Scan(&updaterDisplay)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("productrelease update commit: %w", err)
	}

	return &prd.ProductRelease{
		Version:              v,
		ChangelogMarkdown:    cm,
		UpdatedAt:            ua,
		UpdatedByUserID:      ub,
		UpdatedByDisplayName: updaterDisplay,
	}, nil
}
