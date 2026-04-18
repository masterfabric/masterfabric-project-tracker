package usecase

import (
	"context"
	"strings"

	"github.com/google/uuid"
	feedbackRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/feedback/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// AdminDeleteFeedbackUseCase removes a feedback thread and all messages (admin only).
type AdminDeleteFeedbackUseCase struct {
	repo feedbackRepo.FeedbackRepository
}

// NewAdminDeleteFeedbackUseCase constructs AdminDeleteFeedbackUseCase.
func NewAdminDeleteFeedbackUseCase(repo feedbackRepo.FeedbackRepository) *AdminDeleteFeedbackUseCase {
	return &AdminDeleteFeedbackUseCase{repo: repo}
}

// Execute validates admin and deletes the thread.
func (uc *AdminDeleteFeedbackUseCase) Execute(ctx context.Context, threadIDRaw string) error {
	if err := policy.RequireAdmin(ctx); err != nil {
		return err
	}
	threadID, err := uuid.Parse(strings.TrimSpace(threadIDRaw))
	if err != nil {
		return domainErr.ErrFeedbackThreadNotFound
	}
	return uc.repo.DeleteThread(ctx, threadID)
}
