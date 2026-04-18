package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/notification/dto"
	notifRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/repository"
)

// ListNotificationsUseCase returns notifications with read status for the user.
type ListNotificationsUseCase struct {
	repo notifRepo.NotificationRepository
}

// NewListNotificationsUseCase constructs a ListNotificationsUseCase.
func NewListNotificationsUseCase(repo notifRepo.NotificationRepository) *ListNotificationsUseCase {
	return &ListNotificationsUseCase{repo: repo}
}

// Execute returns notifications. If UserID is set, includes read status.
func (uc *ListNotificationsUseCase) Execute(ctx context.Context, req *dto.ListNotificationsRequest) ([]*dto.NotificationWithReadResponse, error) {
	limit := req.Limit
	if limit < 1 {
		limit = 100
	}

	notifications, err := uc.repo.List(ctx, limit, req.Language)
	if err != nil {
		return nil, fmt.Errorf("listNotifications: %w", err)
	}

	readSet := make(map[uuid.UUID]bool)
	if req.UserID != "" {
		userID, err := uuid.Parse(req.UserID)
		if err == nil {
			readSet, err = uc.repo.GetReadIDs(ctx, userID)
			if err != nil {
				return nil, fmt.Errorf("listNotifications getReadIDs: %w", err)
			}
		}
	}

	result := make([]*dto.NotificationWithReadResponse, 0, len(notifications))
	for _, n := range notifications {
		result = append(result, &dto.NotificationWithReadResponse{
			NotificationResponse: dto.NotificationResponse{
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
			},
			IsRead: readSet[n.ID],
		})
	}
	return result, nil
}
