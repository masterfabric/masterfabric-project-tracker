package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/usermessage/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/usermessage/model"
	usermessageRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/usermessage/repository"
)

// AdminCreateUserMessageUseCase creates a user-specific message (admin only).
type AdminCreateUserMessageUseCase struct {
	repo usermessageRepo.UserMessageRepository
}

// NewAdminCreateUserMessageUseCase constructs an AdminCreateUserMessageUseCase.
func NewAdminCreateUserMessageUseCase(repo usermessageRepo.UserMessageRepository) *AdminCreateUserMessageUseCase {
	return &AdminCreateUserMessageUseCase{repo: repo}
}

// Execute creates a message for the target user.
func (uc *AdminCreateUserMessageUseCase) Execute(ctx context.Context, req *dto.CreateUserMessageRequest) (*dto.UserMessageResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, err
	}
	msgType := model.UserMessageTypeInfo
	if req.Type != "" {
		switch req.Type {
		case "warning":
			msgType = model.UserMessageTypeWarning
		case "success":
			msgType = model.UserMessageTypeSuccess
		case "error":
			msgType = model.UserMessageTypeError
		default:
			msgType = model.UserMessageTypeInfo
		}
	}
	now := time.Now().UTC()
	m := &model.UserMessage{
		ID:        uuid.New(),
		UserID:    userID,
		Message:   req.Message,
		Type:      msgType,
		CreatedAt: now,
	}
	if err := uc.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return &dto.UserMessageResponse{
		ID:        m.ID.String(),
		UserID:    m.UserID.String(),
		Message:   m.Message,
		Type:      string(m.Type),
		CreatedAt: m.CreatedAt,
		ReadAt:    nil,
	}, nil
}
