package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/usermessage/model"
)

// UserMessageRepository defines persistence for user-specific messages.
type UserMessageRepository interface {
	Create(ctx context.Context, m *model.UserMessage) error
	ListByUserID(ctx context.Context, userID uuid.UUID, limit int) ([]*model.UserMessage, error)
	MarkRead(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
	Delete(ctx context.Context, id uuid.UUID) error
}
