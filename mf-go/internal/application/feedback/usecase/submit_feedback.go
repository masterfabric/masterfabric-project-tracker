package usecase

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/feedback/dto"
	feedbackRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/feedback/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/middleware"
)

const (
	maxFeedbackSubject = 200
	maxFeedbackBody    = 8000
)

// SubmitFeedbackUseCase creates a thread with the first user message.
type SubmitFeedbackUseCase struct {
	repo feedbackRepo.FeedbackRepository
}

// NewSubmitFeedbackUseCase constructs SubmitFeedbackUseCase.
func NewSubmitFeedbackUseCase(repo feedbackRepo.FeedbackRepository) *SubmitFeedbackUseCase {
	return &SubmitFeedbackUseCase{repo: repo}
}

func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func isPlausibleEmail(s string) bool {
	if len(s) < 5 || len(s) > 254 {
		return false
	}
	at := strings.LastIndex(s, "@")
	if at <= 0 || at >= len(s)-1 {
		return false
	}
	domain := s[at+1:]
	return strings.Contains(domain, ".")
}

// Execute runs the use case. Authenticated users link the thread to their account; guests must provide contactEmail.
func (uc *SubmitFeedbackUseCase) Execute(ctx context.Context, req *dto.SubmitFeedbackRequest) (*dto.FeedbackThreadResponse, error) {
	authID := middleware.UserIDFromContext(ctx)
	var userPtr *uuid.UUID
	guestEmail := normalizeEmail(req.ContactEmail)
	if authID != uuid.Nil {
		u := authID
		userPtr = &u
		guestEmail = ""
	} else {
		if guestEmail == "" {
			return nil, domainErr.ErrFeedbackGuestEmailRequired
		}
		if !isPlausibleEmail(guestEmail) {
			return nil, domainErr.ErrFeedbackGuestEmailInvalid
		}
	}

	body := strings.TrimSpace(req.Message)
	if body == "" {
		return nil, domainErr.ErrFeedbackMessageEmpty
	}
	if len(body) > maxFeedbackBody {
		body = body[:maxFeedbackBody]
	}
	subject := strings.TrimSpace(req.Subject)
	if len(subject) > maxFeedbackSubject {
		subject = subject[:maxFeedbackSubject]
	}
	if subject == "" {
		subject = "Feedback"
	}

	twm, err := uc.repo.CreateThreadWithMessage(ctx, userPtr, guestEmail, subject, body)
	if err != nil {
		return nil, err
	}
	return threadWithMessagesToDTO(twm), nil
}
