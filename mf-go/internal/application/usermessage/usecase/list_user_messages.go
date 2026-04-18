package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/usermessage/dto"
	usermessageRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/usermessage/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/middleware"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// ListUserMessagesUseCase returns user messages for the authenticated user.
type ListUserMessagesUseCase struct {
	repo usermessageRepo.UserMessageRepository
}

// NewListUserMessagesUseCase constructs a ListUserMessagesUseCase.
func NewListUserMessagesUseCase(repo usermessageRepo.UserMessageRepository) *ListUserMessagesUseCase {
	return &ListUserMessagesUseCase{repo: repo}
}

// Execute returns messages for the current user.
func (uc *ListUserMessagesUseCase) Execute(ctx context.Context, limit int) ([]*dto.UserMessageResponse, error) {
	userID := middleware.UserIDFromContext(ctx)
	if userID == uuid.Nil {
		return nil, domainErr.ErrUnauthorized
	}
	if limit <= 0 {
		limit = 50
	}
	msgs, err := uc.repo.ListByUserID(ctx, userID, limit)
	if err != nil {
		return nil, err
	}
	out := make([]*dto.UserMessageResponse, 0, len(msgs))
	for _, m := range msgs {
		out = append(out, &dto.UserMessageResponse{
			ID:        m.ID.String(),
			UserID:    m.UserID.String(),
			Message:   m.Message,
			Type:      string(m.Type),
			CreatedAt: m.CreatedAt,
			ReadAt:    m.ReadAt,
		})
	}
	return out, nil
}
