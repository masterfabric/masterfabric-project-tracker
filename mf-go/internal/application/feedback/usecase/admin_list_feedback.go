package usecase

import (
	"context"

	"github.com/masterfabric/masterfabric_go_basic/internal/application/feedback/dto"
	feedbackRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/feedback/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
)

// AdminListFeedbackUseCase lists feedback threads for admins.
type AdminListFeedbackUseCase struct {
	repo feedbackRepo.FeedbackRepository
}

// NewAdminListFeedbackUseCase constructs AdminListFeedbackUseCase.
func NewAdminListFeedbackUseCase(repo feedbackRepo.FeedbackRepository) *AdminListFeedbackUseCase {
	return &AdminListFeedbackUseCase{repo: repo}
}

// Execute returns recent threads with owner info.
func (uc *AdminListFeedbackUseCase) Execute(ctx context.Context, limit int) ([]*dto.AdminFeedbackThreadResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	list, err := uc.repo.AdminListThreadsWithMessages(ctx, limit)
	if err != nil {
		return nil, err
	}
	out := make([]*dto.AdminFeedbackThreadResponse, 0, len(list))
	for i := range list {
		twu := list[i]
		out = append(out, &dto.AdminFeedbackThreadResponse{
			Thread:          threadWithMessagesToDTO(&twu.ThreadWithMessages),
			UserEmail:       twu.UserEmail,
			UserDisplayName: twu.UserDisplayName,
		})
	}
	return out, nil
}
