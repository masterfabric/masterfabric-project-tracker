package repository

import (
	"context"

	"github.com/google/uuid"
)

// PasswordHistoryRepository stores retired password hashes for reuse checks (e.g. last 3).
type PasswordHistoryRepository interface {
	// ListRecentHashes returns up to limit most recently retired hashes (newest first).
	ListRecentHashes(ctx context.Context, userID uuid.UUID, limit int) ([]string, error)
	// AppendRetiredPassword records the hash that was just replaced, then keeps at most maxKeep rows per user (oldest removed).
	AppendRetiredPassword(ctx context.Context, userID uuid.UUID, retiredBcryptHash string, maxKeep int) error
}
