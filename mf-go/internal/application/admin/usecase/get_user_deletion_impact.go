package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/admin/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// UserDeletionImpactReader loads DB counts for the deletion preview.
type UserDeletionImpactReader interface {
	FetchCounts(ctx context.Context, userID uuid.UUID) (*dto.UserDeletionImpactResponse, error)
}

// GetUserDeletionImpactUseCase returns what will be removed when an admin deletes a user.
type GetUserDeletionImpactUseCase struct {
	userRepo   repository.UserRepository
	impactRepo UserDeletionImpactReader
}

// NewGetUserDeletionImpactUseCase constructs GetUserDeletionImpactUseCase.
func NewGetUserDeletionImpactUseCase(userRepo repository.UserRepository, impactRepo UserDeletionImpactReader) *GetUserDeletionImpactUseCase {
	return &GetUserDeletionImpactUseCase{userRepo: userRepo, impactRepo: impactRepo}
}

// Execute loads profile + relational counts. Admin only; target user must exist.
func (uc *GetUserDeletionImpactUseCase) Execute(ctx context.Context, targetID uuid.UUID) (*dto.UserDeletionImpactResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}

	u, err := uc.userRepo.FindByID(ctx, targetID)
	if err != nil {
		return nil, err
	}

	resp, err := uc.impactRepo.FetchCounts(ctx, targetID)
	if err != nil {
		return nil, fmt.Errorf("getUserDeletionImpact: %w", err)
	}
	if resp == nil {
		return nil, domainErr.ErrUserNotFound
	}

	resp.Email = u.Email
	resp.DisplayName = u.DisplayName
	return resp, nil
}
