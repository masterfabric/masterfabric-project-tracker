package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/device/model"
)

// DeviceRepository defines persistence for user device registration.
type DeviceRepository interface {
	Upsert(ctx context.Context, d *model.UserDevice) error
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]*model.UserDevice, error)
}
