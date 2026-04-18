package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/settings/model"
)

// UserSettingsRepository defines persistence for per-user settings.
type UserSettingsRepository interface {
	FindByUserID(ctx context.Context, userID uuid.UUID) (*model.UserSettings, error)
	Upsert(ctx context.Context, settings *model.UserSettings) error
}

// AppSettingsRepository defines persistence for application-level config.
type AppSettingsRepository interface {
	FindByKey(ctx context.Context, key string) (*model.AppSettings, error)
	ListPublic(ctx context.Context) ([]*model.AppSettings, error)
	ListAll(ctx context.Context) ([]*model.AppSettings, error)
	Upsert(ctx context.Context, setting *model.AppSettings) error
}
