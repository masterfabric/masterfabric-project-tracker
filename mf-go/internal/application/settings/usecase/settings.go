package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/settings/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	settingsDomainEvent "github.com/masterfabric/masterfabric_go_basic/internal/domain/settings/event"
	settingsModel "github.com/masterfabric/masterfabric_go_basic/internal/domain/settings/model"
	settingsRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/settings/repository"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/events"
)

// GetUserSettingsUseCase retrieves settings for a user, creating defaults if none exist.
type GetUserSettingsUseCase struct {
	repo       settingsRepo.UserSettingsRepository
	cache      *infraRedis.CacheHandler
	keyPrefix  string
	cacheTTL   time.Duration
}

// NewGetUserSettingsUseCase constructs a GetUserSettingsUseCase.
func NewGetUserSettingsUseCase(
	repo settingsRepo.UserSettingsRepository,
	cache *infraRedis.CacheHandler,
	keyPrefix string,
	cacheTTL time.Duration,
) *GetUserSettingsUseCase {
	return &GetUserSettingsUseCase{repo: repo, cache: cache, keyPrefix: keyPrefix, cacheTTL: cacheTTL}
}

// Execute returns user settings or default values.
func (uc *GetUserSettingsUseCase) Execute(ctx context.Context, userID string) (*dto.UserSettingsResponse, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domainErr.ErrUnauthorized
	}

	cacheKey := infraRedis.PrefixedUserSettingsCacheKey(uc.keyPrefix, userID)
	if raw, ok, err := uc.cache.Get(ctx, cacheKey); err == nil && ok {
		var resp dto.UserSettingsResponse
		if json.Unmarshal([]byte(raw), &resp) == nil && resp.UserID == userID {
			return &resp, nil
		}
	}

	s, err := uc.repo.FindByUserID(ctx, id)
	var resp *dto.UserSettingsResponse
	if err != nil {
		resp = &dto.UserSettingsResponse{
			UserID:          userID,
			NotificationsOn: true,
			Theme:           "system",
			Language:        "en",
			Timezone:        "UTC",
			OTPEnabled:      false,
		}
	} else {
		resp = &dto.UserSettingsResponse{
			UserID:          userID,
			NotificationsOn: s.NotificationsOn,
			Theme:           s.Theme,
			Language:        s.Language,
			Timezone:        s.Timezone,
			OTPEnabled:      s.OTPEnabled,
		}
	}

	if b, err := json.Marshal(resp); err == nil {
		_ = uc.cache.Set(ctx, cacheKey, string(b), uc.cacheTTL)
	}
	return resp, nil
}

// UpdateUserSettingsUseCase persists user preference changes.
type UpdateUserSettingsUseCase struct {
	repo      settingsRepo.UserSettingsRepository
	eventBus  events.EventBus
	cache     *infraRedis.CacheHandler
	keyPrefix string
}

// NewUpdateUserSettingsUseCase constructs an UpdateUserSettingsUseCase.
func NewUpdateUserSettingsUseCase(
	repo settingsRepo.UserSettingsRepository,
	eventBus events.EventBus,
	cache *infraRedis.CacheHandler,
	keyPrefix string,
) *UpdateUserSettingsUseCase {
	return &UpdateUserSettingsUseCase{repo: repo, eventBus: eventBus, cache: cache, keyPrefix: keyPrefix}
}

// Execute upserts the user settings.
func (uc *UpdateUserSettingsUseCase) Execute(ctx context.Context, req *dto.UserSettingsRequest) (*dto.UserSettingsResponse, error) {
	id, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, domainErr.ErrUnauthorized
	}

	// Load or create
	s, err := uc.repo.FindByUserID(ctx, id)
	if err != nil {
		s = &settingsModel.UserSettings{
			ID:              uuid.New(),
			UserID:          id,
			NotificationsOn: true,
			Theme:           "system",
			Language:        "en",
			Timezone:        "UTC",
		}
	}

	// Apply partial updates
	if req.NotificationsOn != nil {
		s.NotificationsOn = *req.NotificationsOn
	}
	if req.Theme != nil {
		s.Theme = *req.Theme
	}
	if req.Language != nil {
		s.Language = *req.Language
	}
	if req.Timezone != nil {
		s.Timezone = *req.Timezone
	}
	if req.OTPEnabled != nil {
		s.OTPEnabled = *req.OTPEnabled
	}
	s.UpdatedAt = time.Now().UTC()

	if err := uc.repo.Upsert(ctx, s); err != nil {
		return nil, fmt.Errorf("update settings: %w", err)
	}

	cacheKey := infraRedis.PrefixedUserSettingsCacheKey(uc.keyPrefix, req.UserID)
	_ = uc.cache.Del(ctx, cacheKey)

	_ = uc.eventBus.Publish(ctx, events.TopicUserSettingsUpdated, events.Event{
		Type: settingsDomainEvent.EventUserSettingsUpdated,
		Payload: settingsDomainEvent.UserSettingsUpdatedPayload{
			UserID:    req.UserID,
			UpdatedAt: s.UpdatedAt,
		},
	})

	return &dto.UserSettingsResponse{
		UserID:          req.UserID,
		NotificationsOn: s.NotificationsOn,
		Theme:           s.Theme,
		Language:        s.Language,
		Timezone:        s.Timezone,
		OTPEnabled:      s.OTPEnabled,
	}, nil
}

// GetAppSettingsUseCase returns public application configuration.
type GetAppSettingsUseCase struct {
	repo      settingsRepo.AppSettingsRepository
	cache     *infraRedis.CacheHandler
	keyPrefix string
	cacheTTL  time.Duration
}

// NewGetAppSettingsUseCase constructs a GetAppSettingsUseCase.
func NewGetAppSettingsUseCase(
	repo settingsRepo.AppSettingsRepository,
	cache *infraRedis.CacheHandler,
	keyPrefix string,
	cacheTTL time.Duration,
) *GetAppSettingsUseCase {
	return &GetAppSettingsUseCase{repo: repo, cache: cache, keyPrefix: keyPrefix, cacheTTL: cacheTTL}
}

// Execute returns all public app settings.
func (uc *GetAppSettingsUseCase) Execute(ctx context.Context) ([]*dto.AppSettingResponse, error) {
	cacheKey := infraRedis.PublicAppSettingsSnapshotKey(uc.keyPrefix)
	if raw, ok, err := uc.cache.Get(ctx, cacheKey); err == nil && ok {
		var resp []*dto.AppSettingResponse
		if json.Unmarshal([]byte(raw), &resp) == nil && resp != nil {
			return resp, nil
		}
	}

	settings, err := uc.repo.ListPublic(ctx)
	if err != nil {
		return nil, fmt.Errorf("list app settings: %w", err)
	}

	resp := make([]*dto.AppSettingResponse, 0, len(settings))
	for _, s := range settings {
		resp = append(resp, &dto.AppSettingResponse{
			Key:         s.Key,
			Value:       s.Value,
			Description: s.Description,
		})
	}
	if b, err := json.Marshal(resp); err == nil {
		_ = uc.cache.Set(ctx, cacheKey, string(b), uc.cacheTTL)
	}
	return resp, nil
}

// AdminListAppSettingsUseCase returns all app settings (admin only).
type AdminListAppSettingsUseCase struct {
	repo settingsRepo.AppSettingsRepository
}

// NewAdminListAppSettingsUseCase constructs an AdminListAppSettingsUseCase.
func NewAdminListAppSettingsUseCase(repo settingsRepo.AppSettingsRepository) *AdminListAppSettingsUseCase {
	return &AdminListAppSettingsUseCase{repo: repo}
}

// Execute returns all app settings including non-public.
func (uc *AdminListAppSettingsUseCase) Execute(ctx context.Context) ([]*dto.AdminAppSettingResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	settings, err := uc.repo.ListAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("admin list app settings: %w", err)
	}
	resp := make([]*dto.AdminAppSettingResponse, 0, len(settings))
	for _, s := range settings {
		resp = append(resp, &dto.AdminAppSettingResponse{
			Key:         s.Key,
			Value:       s.Value,
			Description: s.Description,
			IsPublic:    s.IsPublic,
		})
	}
	return resp, nil
}

// AdminUpsertAppSettingUseCase creates or updates an app setting (admin only).
type AdminUpsertAppSettingUseCase struct {
	repo      settingsRepo.AppSettingsRepository
	cache     *infraRedis.CacheHandler
	keyPrefix string
}

// NewAdminUpsertAppSettingUseCase constructs an AdminUpsertAppSettingUseCase.
func NewAdminUpsertAppSettingUseCase(
	repo settingsRepo.AppSettingsRepository,
	cache *infraRedis.CacheHandler,
	keyPrefix string,
) *AdminUpsertAppSettingUseCase {
	return &AdminUpsertAppSettingUseCase{repo: repo, cache: cache, keyPrefix: keyPrefix}
}

// Execute upserts an app setting.
func (uc *AdminUpsertAppSettingUseCase) Execute(ctx context.Context, req *dto.AdminUpsertAppSettingRequest) (*dto.AdminAppSettingResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	existing, _ := uc.repo.FindByKey(ctx, req.Key)
	isPublic := true
	if req.IsPublic != nil {
		isPublic = *req.IsPublic
	} else if existing != nil {
		isPublic = existing.IsPublic
	}
	s := &settingsModel.AppSettings{
		Key:         req.Key,
		Value:       req.Value,
		Description: req.Description,
		IsPublic:    isPublic,
	}
	if existing != nil {
		s.ID = existing.ID
		s.CreatedAt = existing.CreatedAt
	} else {
		s.ID = uuid.Nil // repo will set uuid.New() on insert
	}
	if err := uc.repo.Upsert(ctx, s); err != nil {
		return nil, fmt.Errorf("admin upsert app setting: %w", err)
	}
	snapKey := infraRedis.PublicAppSettingsSnapshotKey(uc.keyPrefix)
	_ = uc.cache.Del(ctx, snapKey)
	return &dto.AdminAppSettingResponse{
		Key:         s.Key,
		Value:       s.Value,
		Description: s.Description,
		IsPublic:    s.IsPublic,
	}, nil
}
