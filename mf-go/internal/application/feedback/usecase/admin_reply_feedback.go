package usecase

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/feedback/dto"
	feedbackmodel "github.com/masterfabric/masterfabric_go_basic/internal/domain/feedback/model"
	feedbackRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/feedback/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// AdminReplyToFeedbackUseCase appends an admin message to a thread.
type AdminReplyToFeedbackUseCase struct {
	repo feedbackRepo.FeedbackRepository
}

// NewAdminReplyToFeedbackUseCase constructs AdminReplyToFeedbackUseCase.
func NewAdminReplyToFeedbackUseCase(repo feedbackRepo.FeedbackRepository) *AdminReplyToFeedbackUseCase {
	return &AdminReplyToFeedbackUseCase{repo: repo}
}

// Execute validates admin and adds the message.
func (uc *AdminReplyToFeedbackUseCase) Execute(ctx context.Context, req *dto.AdminReplyRequest) (*dto.FeedbackMessageResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	threadID, err := uuid.Parse(strings.TrimSpace(req.ThreadID))
	if err != nil {
		return nil, domainErr.ErrFeedbackThreadNotFound
	}
	body := strings.TrimSpace(req.Message)
	if body == "" {
		return nil, domainErr.ErrFeedbackMessageEmpty
	}
	if len(body) > maxFeedbackBody {
		body = body[:maxFeedbackBody]
	}

	m, err := uc.repo.AddMessage(ctx, threadID, feedbackmodel.AuthorRoleAdmin, body)
	if err != nil {
		return nil, err
	}
	return &dto.FeedbackMessageResponse{
		ID:         m.ID.String(),
		ThreadID:   m.ThreadID.String(),
		AuthorRole: string(m.AuthorRole),
		Body:       m.Body,
		CreatedAt:  m.CreatedAt,
	}, nil
}
