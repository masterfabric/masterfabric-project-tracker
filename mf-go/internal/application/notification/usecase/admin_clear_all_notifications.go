package usecase

import (
	"context"

	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	notifRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/repository"
)

// AdminClearAllNotificationsUseCase deletes all notifications (admin only).
// All users will see an empty list when they fetch notifications.
type AdminClearAllNotificationsUseCase struct {
	repo notifRepo.NotificationRepository
}

// NewAdminClearAllNotificationsUseCase constructs an AdminClearAllNotificationsUseCase.
func NewAdminClearAllNotificationsUseCase(repo notifRepo.NotificationRepository) *AdminClearAllNotificationsUseCase {
	return &AdminClearAllNotificationsUseCase{repo: repo}
}

// Execute deletes all notifications. Only ADMIN can call this.
func (uc *AdminClearAllNotificationsUseCase) Execute(ctx context.Context) error {
	if err := policy.RequireAdmin(ctx); err != nil {
		return err
	}
	return uc.repo.DeleteAll(ctx)
}
