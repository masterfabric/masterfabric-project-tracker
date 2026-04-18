package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	notifRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/repository"
)

// AdminDeleteNotificationUseCase deletes a single notification by ID (admin only).
// All users will no longer see it.
type AdminDeleteNotificationUseCase struct {
	repo notifRepo.NotificationRepository
}

// NewAdminDeleteNotificationUseCase constructs an AdminDeleteNotificationUseCase.
func NewAdminDeleteNotificationUseCase(repo notifRepo.NotificationRepository) *AdminDeleteNotificationUseCase {
	return &AdminDeleteNotificationUseCase{repo: repo}
}

// Execute deletes the notification. Only ADMIN can call this.
func (uc *AdminDeleteNotificationUseCase) Execute(ctx context.Context, id uuid.UUID) error {
	if err := policy.RequireAdmin(ctx); err != nil {
		return err
	}
	return uc.repo.DeleteByID(ctx, id)
}
