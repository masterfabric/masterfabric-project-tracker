package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	userUC "github.com/masterfabric/masterfabric_go_basic/internal/application/user/usecase"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// ListOrganizationMessagesUseCase lists chat messages for active members.
type ListOrganizationMessagesUseCase struct {
	repo         orgRepo.OrganizationRepository
	getProfileUC *userUC.GetProfileUseCase
}

// NewListOrganizationMessagesUseCase constructs the use case.
func NewListOrganizationMessagesUseCase(repo orgRepo.OrganizationRepository, getProfileUC *userUC.GetProfileUseCase) *ListOrganizationMessagesUseCase {
	return &ListOrganizationMessagesUseCase{repo: repo, getProfileUC: getProfileUC}
}

// Execute returns newest-first messages.
func (uc *ListOrganizationMessagesUseCase) Execute(ctx context.Context, orgID, callerID uuid.UUID, limit int, before *time.Time) ([]*dto.OrganizationMessageResponse, error) {
	ok, err := uc.repo.IsMember(ctx, orgID, callerID)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationMessages: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("listOrganizationMessages: forbidden")
	}

	items, err := uc.repo.ListMessagesByOrganization(ctx, orgID, limit, before)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationMessages: %w", err)
	}

	out := make([]*dto.OrganizationMessageResponse, 0, len(items))
	for _, m := range items {
		nick := ""
		if p, err := uc.getProfileUC.Execute(ctx, m.AuthorUserID.String()); err == nil && p != nil {
			nick = p.Nickname
		}
		out = append(out, &dto.OrganizationMessageResponse{
			ID:             m.ID.String(),
			OrganizationID: m.OrganizationID.String(),
			AuthorUserID:   m.AuthorUserID.String(),
			AuthorNickname: nick,
			Body:           m.Body,
			CreatedAt:      m.CreatedAt.Format(time.RFC3339),
		})
	}
	return out, nil
}
