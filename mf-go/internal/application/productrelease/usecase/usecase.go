package usecase

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/masterfabric/masterfabric_go_basic/internal/application/productrelease/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	prd "github.com/masterfabric/masterfabric_go_basic/internal/domain/productrelease"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/middleware"
)

// GetProductReleaseUseCase loads the public product release row (no auth).
type GetProductReleaseUseCase struct {
	repo      prd.Repository
	cache     *infraRedis.CacheHandler
	keyPrefix string
	cacheTTL  time.Duration
}

// NewGetProductReleaseUseCase constructs GetProductReleaseUseCase.
func NewGetProductReleaseUseCase(
	repo prd.Repository,
	cache *infraRedis.CacheHandler,
	keyPrefix string,
	cacheTTL time.Duration,
) *GetProductReleaseUseCase {
	return &GetProductReleaseUseCase{repo: repo, cache: cache, keyPrefix: keyPrefix, cacheTTL: cacheTTL}
}

// Execute returns the current published version and changelog.
func (uc *GetProductReleaseUseCase) Execute(ctx context.Context) (*dto.ProductReleaseResponse, error) {
	cacheKey := infraRedis.ProductReleaseCurrentKey(uc.keyPrefix)
	if raw, ok, err := uc.cache.Get(ctx, cacheKey); err == nil && ok {
		var out dto.ProductReleaseResponse
		if json.Unmarshal([]byte(raw), &out) == nil && strings.TrimSpace(out.Version) != "" {
			return &out, nil
		}
	}

	row, err := uc.repo.Get(ctx)
	if err != nil {
		return nil, err
	}
	resp := toDTO(row)
	if b, err := json.Marshal(resp); err == nil {
		_ = uc.cache.Set(ctx, cacheKey, string(b), uc.cacheTTL)
	}
	return resp, nil
}

// AdminUpdateProductReleaseUseCase updates the published release (admin only).
type AdminUpdateProductReleaseUseCase struct {
	repo      prd.Repository
	cache     *infraRedis.CacheHandler
	keyPrefix string
}

// NewAdminUpdateProductReleaseUseCase constructs AdminUpdateProductReleaseUseCase.
func NewAdminUpdateProductReleaseUseCase(
	repo prd.Repository,
	cache *infraRedis.CacheHandler,
	keyPrefix string,
) *AdminUpdateProductReleaseUseCase {
	return &AdminUpdateProductReleaseUseCase{repo: repo, cache: cache, keyPrefix: keyPrefix}
}

// Execute validates input, requires admin, and persists.
func (uc *AdminUpdateProductReleaseUseCase) Execute(ctx context.Context, req *dto.AdminUpdateProductReleaseRequest) (*dto.ProductReleaseResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	v := strings.TrimSpace(req.Version)
	if v == "" {
		return nil, domainErr.ErrProductReleaseVersionRequired
	}
	cm := strings.TrimSpace(req.ChangelogMarkdown)

	uid := middleware.UserIDFromContext(ctx)
	var updatedBy *uuid.UUID
	if uid != uuid.Nil {
		updatedBy = &uid
	}

	row, err := uc.repo.Update(ctx, v, cm, updatedBy)
	if err != nil {
		return nil, err
	}
	cacheKey := infraRedis.ProductReleaseCurrentKey(uc.keyPrefix)
	_ = uc.cache.Del(ctx, cacheKey)
	return toDTO(row), nil
}

func toDTO(row *prd.ProductRelease) *dto.ProductReleaseResponse {
	var name *string
	if row.UpdatedByDisplayName != "" {
		s := row.UpdatedByDisplayName
		name = &s
	}
	return &dto.ProductReleaseResponse{
		Version:              row.Version,
		ChangelogMarkdown:    row.ChangelogMarkdown,
		UpdatedAt:            row.UpdatedAt,
		UpdatedByDisplayName: name,
	}
}
