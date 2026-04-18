package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/usermessage/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/middleware"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// MarkUserMessageReadUseCase marks a user message as read.
type MarkUserMessageReadUseCase struct {
	repo repository.UserMessageRepository
}

// NewMarkUserMessageReadUseCase constructs a MarkUserMessageReadUseCase.
func NewMarkUserMessageReadUseCase(repo repository.UserMessageRepository) *MarkUserMessageReadUseCase {
	return &MarkUserMessageReadUseCase{repo: repo}
}

// Execute marks the message as read for the current user.
func (uc *MarkUserMessageReadUseCase) Execute(ctx context.Context, messageID string) error {
	userID := middleware.UserIDFromContext(ctx)
	if userID == uuid.Nil {
		return domainErr.ErrUnauthorized
	}
	id, err := uuid.Parse(messageID)
	if err != nil {
		return err
	}
	return uc.repo.MarkRead(ctx, id, userID)
}
