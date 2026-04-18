package settings

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/settings/model"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// UserSettingsRepo is the PostgreSQL implementation of domain UserSettingsRepository.
type UserSettingsRepo struct {
	db *pgxpool.Pool
}

// NewUserSettingsRepo creates a new UserSettingsRepo.
func NewUserSettingsRepo(db *pgxpool.Pool) *UserSettingsRepo {
	return &UserSettingsRepo{db: db}
}

const (
	sqlFindUserSettings = `
		SELECT id, user_id, notifications_on, theme, language, timezone, otp_enabled, created_at, updated_at
		FROM user_settings WHERE user_id = $1`

	sqlUpsertUserSettings = `
		INSERT INTO user_settings (id, user_id, notifications_on, theme, language, timezone, otp_enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id) DO UPDATE
		SET notifications_on = EXCLUDED.notifications_on,
		    theme             = EXCLUDED.theme,
		    language          = EXCLUDED.language,
		    timezone          = EXCLUDED.timezone,
		    otp_enabled       = EXCLUDED.otp_enabled,
		    updated_at        = EXCLUDED.updated_at`
)

// FindByUserID returns the settings for the given user.
func (r *UserSettingsRepo) FindByUserID(ctx context.Context, userID uuid.UUID) (*model.UserSettings, error) {
	row := r.db.QueryRow(ctx, sqlFindUserSettings, userID)
	s, err := scanUserSettings(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domainErr.ErrSettingsNotFound
		}
		return nil, fmt.Errorf("userSettingsRepo.FindByUserID: %w", err)
	}
	return s, nil
}

// Upsert creates or replaces the user's settings record.
func (r *UserSettingsRepo) Upsert(ctx context.Context, s *model.UserSettings) error {
	now := time.Now().UTC()
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
		s.CreatedAt = now
	}
	s.UpdatedAt = now

	_, err := r.db.Exec(ctx, sqlUpsertUserSettings,
		s.ID, s.UserID, s.NotificationsOn, s.Theme, s.Language, s.Timezone, s.OTPEnabled, s.CreatedAt, s.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("userSettingsRepo.Upsert: %w", err)
	}
	return nil
}

func scanUserSettings(row pgx.Row) (*model.UserSettings, error) {
	var s model.UserSettings
	err := row.Scan(
		&s.ID,
		&s.UserID,
		&s.NotificationsOn,
		&s.Theme,
		&s.Language,
		&s.Timezone,
		&s.OTPEnabled,
		&s.CreatedAt,
		&s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ---------------------------------------------------------------------------
// AppSettingsRepo
// ---------------------------------------------------------------------------

// AppSettingsRepo is the PostgreSQL implementation of domain AppSettingsRepository.
type AppSettingsRepo struct {
	db *pgxpool.Pool
}

// NewAppSettingsRepo creates a new AppSettingsRepo.
func NewAppSettingsRepo(db *pgxpool.Pool) *AppSettingsRepo {
	return &AppSettingsRepo{db: db}
}

const (
	sqlFindAppSettingByKey = `
		SELECT id, key, value, description, is_public, created_at, updated_at
		FROM app_settings WHERE key = $1`

	sqlListPublicAppSettings = `
		SELECT id, key, value, description, is_public, created_at, updated_at
		FROM app_settings WHERE is_public = true ORDER BY key`

	sqlListAllAppSettings = `
		SELECT id, key, value, description, is_public, created_at, updated_at
		FROM app_settings ORDER BY key`

	sqlUpsertAppSetting = `
		INSERT INTO app_settings (id, key, value, description, is_public, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (key) DO UPDATE
		SET value       = EXCLUDED.value,
		    description = EXCLUDED.description,
		    is_public   = EXCLUDED.is_public,
		    updated_at  = EXCLUDED.updated_at`
)

// FindByKey retrieves an app setting by its key.
func (r *AppSettingsRepo) FindByKey(ctx context.Context, key string) (*model.AppSettings, error) {
	row := r.db.QueryRow(ctx, sqlFindAppSettingByKey, key)
	s, err := scanAppSetting(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domainErr.ErrSettingsNotFound
		}
		return nil, fmt.Errorf("appSettingsRepo.FindByKey: %w", err)
	}
	return s, nil
}

// ListPublic returns all app settings visible to mobile clients.
func (r *AppSettingsRepo) ListPublic(ctx context.Context) ([]*model.AppSettings, error) {
	rows, err := r.db.Query(ctx, sqlListPublicAppSettings)
	if err != nil {
		return nil, fmt.Errorf("appSettingsRepo.ListPublic: %w", err)
	}
	defer rows.Close()

	var results []*model.AppSettings
	for rows.Next() {
		s, err := scanAppSetting(rows)
		if err != nil {
			return nil, fmt.Errorf("appSettingsRepo.ListPublic scan: %w", err)
		}
		results = append(results, s)
	}
	return results, rows.Err()
}

// ListAll returns all app settings (admin only).
func (r *AppSettingsRepo) ListAll(ctx context.Context) ([]*model.AppSettings, error) {
	rows, err := r.db.Query(ctx, sqlListAllAppSettings)
	if err != nil {
		return nil, fmt.Errorf("appSettingsRepo.ListAll: %w", err)
	}
	defer rows.Close()

	var results []*model.AppSettings
	for rows.Next() {
		s, err := scanAppSetting(rows)
		if err != nil {
			return nil, fmt.Errorf("appSettingsRepo.ListAll scan: %w", err)
		}
		results = append(results, s)
	}
	return results, rows.Err()
}

// Upsert creates or replaces an app setting.
func (r *AppSettingsRepo) Upsert(ctx context.Context, s *model.AppSettings) error {
	now := time.Now().UTC()
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
		s.CreatedAt = now
	}
	s.UpdatedAt = now

	_, err := r.db.Exec(ctx, sqlUpsertAppSetting,
		s.ID, s.Key, s.Value, s.Description, s.IsPublic, s.CreatedAt, s.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("appSettingsRepo.Upsert: %w", err)
	}
	return nil
}

// pgx.Rows satisfies pgx.Row so we can reuse the same scan helper.
func scanAppSetting(row pgx.Row) (*model.AppSettings, error) {
	var s model.AppSettings
	err := row.Scan(
		&s.ID,
		&s.Key,
		&s.Value,
		&s.Description,
		&s.IsPublic,
		&s.CreatedAt,
		&s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}
