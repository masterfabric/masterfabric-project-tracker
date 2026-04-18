package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/notification/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	notifModel "github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/model"
	notifRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/repository"
	pushevent "github.com/masterfabric/masterfabric_go_basic/internal/domain/push/event"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/events"
)

// AdminCreateNotificationUseCase creates a broadcast notification (admin only).
type AdminCreateNotificationUseCase struct {
	repo     notifRepo.NotificationRepository
	eventBus events.EventBus
}

// NewAdminCreateNotificationUseCase constructs an AdminCreateNotificationUseCase.
func NewAdminCreateNotificationUseCase(repo notifRepo.NotificationRepository, bus events.EventBus) *AdminCreateNotificationUseCase {
	return &AdminCreateNotificationUseCase{repo: repo, eventBus: bus}
}

// Execute creates a notification. Only ADMIN can call this.
func (uc *AdminCreateNotificationUseCase) Execute(ctx context.Context, req *dto.CreateNotificationRequest) (*dto.NotificationResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}

	nType := notifModel.NotificationType(req.Type)
	if nType == "" {
		nType = notifModel.NotificationTypeInfo
	}
	if nType != notifModel.NotificationTypeInfo && nType != notifModel.NotificationTypeWarning &&
		nType != notifModel.NotificationTypeSuccess && nType != notifModel.NotificationTypeError {
		nType = notifModel.NotificationTypeInfo
	}

	category := req.Category
	if category == "" {
		category = "app"
	}
	priority := req.Priority
	if priority != "high" && priority != "low" {
		priority = "normal"
	}

	now := time.Now().UTC()
	n := &notifModel.Notification{
		ID:        uuid.New(),
		Title:     req.Title,
		Subtitle:  req.Subtitle,
		Message:   req.Message,
		Type:      nType,
		Category:  category,
		Icon:      req.Icon,
		Language:  req.Language,
		ActionURL: req.ActionURL,
		ImageURL:  req.ImageURL,
		Priority:  priority,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := uc.repo.Create(ctx, n); err != nil {
		return nil, fmt.Errorf("adminCreateNotification: %w", err)
	}

	if req.SendPush && uc.eventBus != nil {
		_ = uc.eventBus.Publish(ctx, events.TopicPushAdminBroadcast, events.Event{
			Type: pushevent.EventAdminBroadcastPush,
			Payload: pushevent.AdminBroadcastPushPayload{
				NotificationID: n.ID.String(),
				Title:          n.Title,
				Subtitle:       n.Subtitle,
				Message:        n.Message,
				ActionURL:      n.ActionURL,
				Category:       n.Category,
			},
		})
	}

	return &dto.NotificationResponse{
		ID:        n.ID.String(),
		Title:     n.Title,
		Subtitle:  n.Subtitle,
		Message:   n.Message,
		Type:      string(n.Type),
		Category:  n.Category,
		Icon:      n.Icon,
		Language:  n.Language,
		ActionURL: n.ActionURL,
		ImageURL:  n.ImageURL,
		Priority:  n.Priority,
		CreatedAt: n.CreatedAt.Format(time.RFC3339),
		UpdatedAt: n.UpdatedAt.Format(time.RFC3339),
	}, nil
}
