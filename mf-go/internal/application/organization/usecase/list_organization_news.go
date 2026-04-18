package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	userUC "github.com/masterfabric/masterfabric_go_basic/internal/application/user/usecase"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// ListOrganizationNewsUseCase lists news for members.
type ListOrganizationNewsUseCase struct {
	repo         orgRepo.OrganizationRepository
	getProfileUC *userUC.GetProfileUseCase
}

// NewListOrganizationNewsUseCase constructs the use case.
func NewListOrganizationNewsUseCase(repo orgRepo.OrganizationRepository, getProfileUC *userUC.GetProfileUseCase) *ListOrganizationNewsUseCase {
	return &ListOrganizationNewsUseCase{repo: repo, getProfileUC: getProfileUC}
}

// Execute returns newest-first news.
func (uc *ListOrganizationNewsUseCase) Execute(ctx context.Context, orgID, callerID uuid.UUID, limit int, before *time.Time) ([]*dto.OrganizationNewsResponse, error) {
	ok, err := uc.repo.IsMember(ctx, orgID, callerID)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationNews: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("listOrganizationNews: forbidden")
	}

	items, err := uc.repo.ListNewsByOrganization(ctx, orgID, limit, before)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationNews: %w", err)
	}

	out := make([]*dto.OrganizationNewsResponse, 0, len(items))
	for _, n := range items {
		nick := ""
		if p, err := uc.getProfileUC.Execute(ctx, n.AuthorUserID.String()); err == nil && p != nil {
			nick = p.Nickname
		}
		var meta *string
		if len(n.RichMetadata) > 0 {
			if json.Valid(n.RichMetadata) {
				s := string(n.RichMetadata)
				meta = &s
			}
		}
		out = append(out, &dto.OrganizationNewsResponse{
			ID:             n.ID.String(),
			OrganizationID: n.OrganizationID.String(),
			AuthorUserID:   n.AuthorUserID.String(),
			AuthorNickname: nick,
			Title:          n.Title,
			Description:    n.Description,
			ImageURL:       n.ImageURL,
			RichMetadata:   meta,
			CreatedAt:      n.CreatedAt.Format(time.RFC3339),
			UpdatedAt:      n.UpdatedAt.Format(time.RFC3339),
		})
	}
	return out, nil
}
