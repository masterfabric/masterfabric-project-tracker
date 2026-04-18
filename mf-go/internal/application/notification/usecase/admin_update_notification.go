package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	notifModel "github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/repository"
)

// AdminUpdateNotificationRequest holds optional fields to patch.
type AdminUpdateNotificationRequest struct {
	Title     *string
	Subtitle  *string
	Message   *string
	Type      *string
	Category  *string
	Icon      *string
	Language  *string
	ActionURL *string
	ImageURL  *string
	Priority  *string
}

// AdminUpdateNotificationUseCase updates a broadcast notification (admin only).
type AdminUpdateNotificationUseCase struct {
	repo repository.NotificationRepository
}

func NewAdminUpdateNotificationUseCase(repo repository.NotificationRepository) *AdminUpdateNotificationUseCase {
	return &AdminUpdateNotificationUseCase{repo: repo}
}

func (uc *AdminUpdateNotificationUseCase) Execute(ctx context.Context, id uuid.UUID, req *AdminUpdateNotificationRequest) (*notifModel.Notification, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	n, err := uc.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.Title != nil {
		n.Title = strings.TrimSpace(*req.Title)
	}
	if req.Subtitle != nil {
		n.Subtitle = strings.TrimSpace(*req.Subtitle)
	}
	if req.Message != nil {
		n.Message = strings.TrimSpace(*req.Message)
	}
	if req.Type != nil && *req.Type != "" {
		n.Type = notifModel.NotificationType(*req.Type)
	}
	if req.Category != nil {
		n.Category = strings.TrimSpace(*req.Category)
	}
	if req.Icon != nil {
		n.Icon = strings.TrimSpace(*req.Icon)
	}
	if req.Language != nil {
		n.Language = strings.TrimSpace(*req.Language)
	}
	if req.ActionURL != nil {
		n.ActionURL = strings.TrimSpace(*req.ActionURL)
	}
	if req.ImageURL != nil {
		n.ImageURL = strings.TrimSpace(*req.ImageURL)
	}
	if req.Priority != nil {
		n.Priority = strings.TrimSpace(*req.Priority)
	}
	if n.Title == "" || n.Message == "" {
		return nil, fmt.Errorf("title and message are required")
	}
	n.UpdatedAt = time.Now().UTC()
	if err := uc.repo.Update(ctx, n); err != nil {
		return nil, err
	}
	return n, nil
}
