package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/notification/dto"
	notifRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/repository"
)

// MarkNotificationReadUseCase marks a single notification as read.
type MarkNotificationReadUseCase struct {
	repo notifRepo.NotificationRepository
}

// NewMarkNotificationReadUseCase constructs a MarkNotificationReadUseCase.
func NewMarkNotificationReadUseCase(repo notifRepo.NotificationRepository) *MarkNotificationReadUseCase {
	return &MarkNotificationReadUseCase{repo: repo}
}

// Execute marks the notification as read for the user.
func (uc *MarkNotificationReadUseCase) Execute(ctx context.Context, req *dto.MarkNotificationReadRequest) error {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return fmt.Errorf("markNotificationRead: invalid user id: %w", err)
	}
	notificationID, err := uuid.Parse(req.NotificationID)
	if err != nil {
		return fmt.Errorf("markNotificationRead: invalid notification id: %w", err)
	}
	return uc.repo.MarkRead(ctx, userID, notificationID)
}
