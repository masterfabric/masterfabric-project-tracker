package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	iammodel "github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/model"
	iamRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// ensureActiveUserForTodos blocks todo read/write when the IAM user is not ACTIVE
// (matches login / refresh: inactive and suspended accounts must not use product data).
func ensureActiveUserForTodos(ctx context.Context, userRepo iamRepo.UserRepository, userID uuid.UUID) error {
	u, err := userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("todo access: %w", err)
	}
	if u.Status != iammodel.UserStatusActive {
		return domainErr.ErrAccountDisabled
	}
	return nil
}
