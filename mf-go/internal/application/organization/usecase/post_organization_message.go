package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	userUC "github.com/masterfabric/masterfabric_go_basic/internal/application/user/usecase"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

const maxOrgMessageRunes = 8000

// PostOrganizationMessageUseCase posts to the org channel.
type PostOrganizationMessageUseCase struct {
	repo         orgRepo.OrganizationRepository
	getProfileUC *userUC.GetProfileUseCase
}

// NewPostOrganizationMessageUseCase constructs the use case.
func NewPostOrganizationMessageUseCase(repo orgRepo.OrganizationRepository, getProfileUC *userUC.GetProfileUseCase) *PostOrganizationMessageUseCase {
	return &PostOrganizationMessageUseCase{repo: repo, getProfileUC: getProfileUC}
}

// Execute inserts a message.
func (uc *PostOrganizationMessageUseCase) Execute(ctx context.Context, req *dto.PostOrganizationMessageRequest) (*dto.OrganizationMessageResponse, error) {
	orgID, err := uuid.Parse(req.OrganizationID)
	if err != nil {
		return nil, fmt.Errorf("postOrganizationMessage: invalid org id: %w", err)
	}
	actorID, err := uuid.Parse(req.ActorUserID)
	if err != nil {
		return nil, fmt.Errorf("postOrganizationMessage: invalid actor: %w", err)
	}

	ok, err := uc.repo.IsMember(ctx, orgID, actorID)
	if err != nil {
		return nil, fmt.Errorf("postOrganizationMessage: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("postOrganizationMessage: forbidden")
	}

	body := strings.TrimSpace(req.Body)
	if body == "" {
		return nil, fmt.Errorf("postOrganizationMessage: body is required")
	}
	if utf8.RuneCountInString(body) > maxOrgMessageRunes {
		return nil, fmt.Errorf("postOrganizationMessage: body too long")
	}

	now := time.Now().UTC()
	m := &model.OrganizationMessage{
		ID:             uuid.New(),
		OrganizationID: orgID,
		AuthorUserID:   actorID,
		Body:           body,
		CreatedAt:      now,
	}
	if err := uc.repo.CreateMessage(ctx, m); err != nil {
		return nil, fmt.Errorf("postOrganizationMessage: %w", err)
	}

	nick := ""
	if p, err := uc.getProfileUC.Execute(ctx, actorID.String()); err == nil && p != nil {
		nick = p.Nickname
	}

	return &dto.OrganizationMessageResponse{
		ID:             m.ID.String(),
		OrganizationID: m.OrganizationID.String(),
		AuthorUserID:   m.AuthorUserID.String(),
		AuthorNickname: nick,
		Body:           m.Body,
		CreatedAt:      m.CreatedAt.Format(time.RFC3339),
	}, nil
}
