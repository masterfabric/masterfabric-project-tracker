package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/model"
)

// NotificationRepository defines persistence for notifications and read status.
type NotificationRepository interface {
	Create(ctx context.Context, n *model.Notification) error
	List(ctx context.Context, limit int, language string) ([]*model.Notification, error)
	MarkRead(ctx context.Context, userID, notificationID uuid.UUID) error
	MarkAllRead(ctx context.Context, userID uuid.UUID, notificationIDs []uuid.UUID) error
	MarkAllReadForUser(ctx context.Context, userID uuid.UUID) error
	GetReadIDs(ctx context.Context, userID uuid.UUID) (map[uuid.UUID]bool, error)
	DeleteAll(ctx context.Context) error
	DeleteByID(ctx context.Context, id uuid.UUID) error
	FindByID(ctx context.Context, id uuid.UUID) (*model.Notification, error)
	Update(ctx context.Context, n *model.Notification) error
}
