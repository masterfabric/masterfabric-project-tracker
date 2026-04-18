package iam

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
)

// PasswordHistoryRepo implements repository.PasswordHistoryRepository.
type PasswordHistoryRepo struct {
	db *pgxpool.Pool
}

// NewPasswordHistoryRepo constructs a PasswordHistoryRepo.
func NewPasswordHistoryRepo(db *pgxpool.Pool) *PasswordHistoryRepo {
	return &PasswordHistoryRepo{db: db}
}

var _ repository.PasswordHistoryRepository = (*PasswordHistoryRepo)(nil)

func (r *PasswordHistoryRepo) ListRecentHashes(ctx context.Context, userID uuid.UUID, limit int) ([]string, error) {
	if limit < 1 {
		return nil, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT password_hash
		FROM user_password_history
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("password history list: %w", err)
	}
	defer rows.Close()
	out := make([]string, 0, limit)
	for rows.Next() {
		var h string
		if err := rows.Scan(&h); err != nil {
			return nil, fmt.Errorf("password history scan: %w", err)
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (r *PasswordHistoryRepo) AppendRetiredPassword(ctx context.Context, userID uuid.UUID, retiredBcryptHash string, maxKeep int) error {
	if maxKeep < 1 {
		maxKeep = 3
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("password history tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		INSERT INTO user_password_history (user_id, password_hash)
		VALUES ($1, $2)
	`, userID, retiredBcryptHash); err != nil {
		return fmt.Errorf("password history insert: %w", err)
	}

	// Delete rows for this user outside the newest maxKeep (by created_at).
	if _, err := tx.Exec(ctx, `
		DELETE FROM user_password_history u
		WHERE u.user_id = $1
		  AND u.id NOT IN (
			SELECT id FROM user_password_history
			WHERE user_id = $1
			ORDER BY created_at DESC
			LIMIT $2
		  )
	`, userID, maxKeep); err != nil {
		return fmt.Errorf("password history prune: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("password history commit: %w", err)
	}
	return nil
}
