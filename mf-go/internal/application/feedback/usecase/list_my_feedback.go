package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/feedback/dto"
	feedbackmodel "github.com/masterfabric/masterfabric_go_basic/internal/domain/feedback/model"
	feedbackRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/feedback/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/middleware"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// ListMyFeedbackUseCase lists the current user's feedback threads.
type ListMyFeedbackUseCase struct {
	repo feedbackRepo.FeedbackRepository
}

// NewListMyFeedbackUseCase constructs ListMyFeedbackUseCase.
func NewListMyFeedbackUseCase(repo feedbackRepo.FeedbackRepository) *ListMyFeedbackUseCase {
	return &ListMyFeedbackUseCase{repo: repo}
}

// Execute returns threads for the authenticated user.
func (uc *ListMyFeedbackUseCase) Execute(ctx context.Context) ([]*dto.FeedbackThreadResponse, error) {
	userID := middleware.UserIDFromContext(ctx)
	if userID == uuid.Nil {
		return nil, domainErr.ErrUnauthorized
	}
	list, err := uc.repo.ListThreadsWithMessagesByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]*dto.FeedbackThreadResponse, 0, len(list))
	for i := range list {
		out = append(out, threadWithMessagesToDTO(&list[i]))
	}
	return out, nil
}

func threadWithMessagesToDTO(twm *feedbackmodel.ThreadWithMessages) *dto.FeedbackThreadResponse {
	msgs := make([]*dto.FeedbackMessageResponse, 0, len(twm.Messages))
	for i := range twm.Messages {
		m := twm.Messages[i]
		msgs = append(msgs, &dto.FeedbackMessageResponse{
			ID:         m.ID.String(),
			ThreadID:   m.ThreadID.String(),
			AuthorRole: string(m.AuthorRole),
			Body:       m.Body,
			CreatedAt:  m.CreatedAt,
		})
	}
	uidStr := ""
	if twm.Thread.UserID != nil {
		uidStr = twm.Thread.UserID.String()
	}
	return &dto.FeedbackThreadResponse{
		ID:           twm.Thread.ID.String(),
		UserID:       uidStr,
		ContactEmail: twm.Thread.GuestContactEmail,
		Subject:      twm.Thread.Subject,
		Status:       twm.Thread.Status,
		CreatedAt:    twm.Thread.CreatedAt,
		UpdatedAt:    twm.Thread.UpdatedAt,
		Messages:     msgs,
	}
}
