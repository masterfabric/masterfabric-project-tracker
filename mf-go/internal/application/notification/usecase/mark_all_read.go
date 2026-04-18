package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	notifRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/repository"
)

// MarkAllNotificationsReadUseCase marks all notifications as read for a user.
type MarkAllNotificationsReadUseCase struct {
	repo notifRepo.NotificationRepository
}

// NewMarkAllNotificationsReadUseCase constructs a MarkAllNotificationsReadUseCase.
func NewMarkAllNotificationsReadUseCase(repo notifRepo.NotificationRepository) *MarkAllNotificationsReadUseCase {
	return &MarkAllNotificationsReadUseCase{repo: repo}
}

// MarkAllNotificationsReadRequest is the input.
type MarkAllNotificationsReadRequest struct {
	UserID string
}

// Execute marks all notifications as read for the user.
func (uc *MarkAllNotificationsReadUseCase) Execute(ctx context.Context, req *MarkAllNotificationsReadRequest) error {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return fmt.Errorf("markAllNotificationsRead: invalid user id: %w", err)
	}
	return uc.repo.MarkAllReadForUser(ctx, userID)
}
