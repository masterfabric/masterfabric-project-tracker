package usermessage

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/usermessage/model"
)

// UserMessageRepo is the PostgreSQL implementation of UserMessageRepository.
type UserMessageRepo struct {
	db *pgxpool.Pool
}

// NewUserMessageRepo creates a new UserMessageRepo.
func NewUserMessageRepo(db *pgxpool.Pool) *UserMessageRepo {
	return &UserMessageRepo{db: db}
}

const (
	sqlCreate = `
		INSERT INTO user_messages (id, user_id, message, type, created_at)
		VALUES ($1, $2, $3, $4, $5)`

	sqlListByUserID = `
		SELECT id, user_id, message, type, created_at, read_at
		FROM user_messages
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2`

	sqlMarkRead = `
		UPDATE user_messages SET read_at = NOW()
		WHERE id = $1 AND user_id = $2 AND read_at IS NULL`

	sqlDelete = `DELETE FROM user_messages WHERE id = $1`
)

// Create inserts a new user message.
func (r *UserMessageRepo) Create(ctx context.Context, m *model.UserMessage) error {
	_, err := r.db.Exec(ctx, sqlCreate,
		m.ID, m.UserID, m.Message, string(m.Type), m.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("userMessageRepo.Create: %w", err)
	}
	return nil
}

// ListByUserID returns messages for a user.
func (r *UserMessageRepo) ListByUserID(ctx context.Context, userID uuid.UUID, limit int) ([]*model.UserMessage, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, sqlListByUserID, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("userMessageRepo.ListByUserID: %w", err)
	}
	defer rows.Close()

	var result []*model.UserMessage
	for rows.Next() {
		m, err := scanUserMessage(rows)
		if err != nil {
			return nil, fmt.Errorf("userMessageRepo.ListByUserID scan: %w", err)
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

// MarkRead marks a message as read for the user.
func (r *UserMessageRepo) MarkRead(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, sqlMarkRead, id, userID)
	if err != nil {
		return fmt.Errorf("userMessageRepo.MarkRead: %w", err)
	}
	return nil
}

// Delete removes a message.
func (r *UserMessageRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, sqlDelete, id)
	if err != nil {
		return fmt.Errorf("userMessageRepo.Delete: %w", err)
	}
	return nil
}

func scanUserMessage(row pgx.Row) (*model.UserMessage, error) {
	var m model.UserMessage
	var readAt pgtype.Timestamptz
	err := row.Scan(&m.ID, &m.UserID, &m.Message, (*string)(&m.Type), &m.CreatedAt, &readAt)
	if err != nil {
		return nil, err
	}
	if readAt.Valid {
		m.ReadAt = &readAt.Time
	}
	return &m, nil
}
