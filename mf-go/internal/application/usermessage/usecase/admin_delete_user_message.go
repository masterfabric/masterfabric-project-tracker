package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/usermessage/repository"
)

// AdminDeleteUserMessageUseCase deletes a user message (admin only).
type AdminDeleteUserMessageUseCase struct {
	repo repository.UserMessageRepository
}

// NewAdminDeleteUserMessageUseCase constructs an AdminDeleteUserMessageUseCase.
func NewAdminDeleteUserMessageUseCase(repo repository.UserMessageRepository) *AdminDeleteUserMessageUseCase {
	return &AdminDeleteUserMessageUseCase{repo: repo}
}

// Execute deletes the message.
func (uc *AdminDeleteUserMessageUseCase) Execute(ctx context.Context, messageID string) error {
	if err := policy.RequireAdmin(ctx); err != nil {
		return err
	}
	id, err := uuid.Parse(messageID)
	if err != nil {
		return err
	}
	return uc.repo.Delete(ctx, id)
}
