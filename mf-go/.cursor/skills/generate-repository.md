# Skill: Generate Repository Implementation

## Trigger
Use this skill when asked to: "implement repository", "add postgres repository", "create DB adapter"

## Inputs Required
- `<context>` — bounded context (e.g., `iam`, `settings`)
- `<Entity>` — PascalCase entity name
- interface — the domain repository interface to implement

## Output File

### `internal/infrastructure/postgres/<context>/<entity>_repository.go`
```go
package <context>

import (
    "context"
    "errors"
    "fmt"

    "github.com/jackc/pgx/v5"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/google/uuid"

    domainModel "<module>/internal/domain/<context>/model"
    domainRepo  "<module>/internal/domain/<context>/repository"
    domainErr   "<module>/internal/shared/errors"
)

type <Entity>Repository struct {
    pool *pgxpool.Pool
}

// Compile-time interface check
var _ domainRepo.<Entity>Repository = (*<Entity>Repository)(nil)

func New<Entity>Repository(pool *pgxpool.Pool) *<Entity>Repository {
    return &<Entity>Repository{pool: pool}
}

func (r *<Entity>Repository) Create(ctx context.Context, entity *domainModel.<Entity>) error {
    _, err := r.pool.Exec(ctx, `
        INSERT INTO <table> (id, ..., created_at, updated_at)
        VALUES ($1, ..., $2, $3)
    `, entity.ID, entity.CreatedAt, entity.UpdatedAt)
    if err != nil {
        return fmt.Errorf("<entity>Repo.Create: %w", err)
    }
    return nil
}

func (r *<Entity>Repository) FindByID(ctx context.Context, id uuid.UUID) (*domainModel.<Entity>, error) {
    row := r.pool.QueryRow(ctx, `
        SELECT id, ..., created_at, updated_at
        FROM <table>
        WHERE id = $1
    `, id)

    var entity domainModel.<Entity>
    err := row.Scan(&entity.ID, &entity.CreatedAt, &entity.UpdatedAt)
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, domainErr.Err<Entity>NotFound
        }
        return nil, fmt.Errorf("<entity>Repo.FindByID: %w", err)
    }
    return &entity, nil
}

func (r *<Entity>Repository) Update(ctx context.Context, entity *domainModel.<Entity>) error {
    tag, err := r.pool.Exec(ctx, `
        UPDATE <table>
        SET ..., updated_at = $2
        WHERE id = $1
    `, entity.ID, entity.UpdatedAt)
    if err != nil {
        return fmt.Errorf("<entity>Repo.Update: %w", err)
    }
    if tag.RowsAffected() == 0 {
        return domainErr.Err<Entity>NotFound
    }
    return nil
}

func (r *<Entity>Repository) Delete(ctx context.Context, id uuid.UUID) error {
    tag, err := r.pool.Exec(ctx, `DELETE FROM <table> WHERE id = $1`, id)
    if err != nil {
        return fmt.Errorf("<entity>Repo.Delete: %w", err)
    }
    if tag.RowsAffected() == 0 {
        return domainErr.Err<Entity>NotFound
    }
    return nil
}
```

## SQL Migration

### `internal/infrastructure/postgres/migrations/<timestamp>_add_<table>.sql`
```sql
-- +goose Up
CREATE TABLE <table> (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- columns matching domain model fields
    status     TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_<table>_<field> ON <table>(<field>);

-- +goose Down
DROP TABLE <table>;
```

## Validation Rules
- Always use `pgxpool.Pool`, never `database/sql`
- Compile-time interface assertion required
- Map `pgx.ErrNoRows` to domain sentinel error
- All errors wrapped with `fmt.Errorf("repoName.Method: %w", err)`
- Migration must include Down section
