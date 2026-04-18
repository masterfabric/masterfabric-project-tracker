package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	userUC "github.com/masterfabric/masterfabric_go_basic/internal/application/user/usecase"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// UpdateOrganizationNewsUseCase updates a post (org owner only).
type UpdateOrganizationNewsUseCase struct {
	repo         orgRepo.OrganizationRepository
	getProfileUC *userUC.GetProfileUseCase
}

// NewUpdateOrganizationNewsUseCase constructs the use case.
func NewUpdateOrganizationNewsUseCase(repo orgRepo.OrganizationRepository, getProfileUC *userUC.GetProfileUseCase) *UpdateOrganizationNewsUseCase {
	return &UpdateOrganizationNewsUseCase{repo: repo, getProfileUC: getProfileUC}
}

// Execute updates fields.
func (uc *UpdateOrganizationNewsUseCase) Execute(ctx context.Context, req *dto.UpdateOrganizationNewsRequest) (*dto.OrganizationNewsResponse, error) {
	newsID, err := uuid.Parse(req.NewsID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganizationNews: invalid news id: %w", err)
	}
	actorID, err := uuid.Parse(req.ActorUserID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganizationNews: invalid actor: %w", err)
	}

	n, err := uc.repo.GetNewsByID(ctx, newsID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganizationNews: %w", err)
	}
	if n == nil {
		return nil, fmt.Errorf("updateOrganizationNews: not found")
	}

	org, err := uc.repo.GetByID(ctx, n.OrganizationID)
	if err != nil || org == nil {
		return nil, fmt.Errorf("updateOrganizationNews: organization not found")
	}
	if org.OwnerUserID != actorID {
		return nil, fmt.Errorf("updateOrganizationNews: only organization owner can edit news")
	}

	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" {
			return nil, fmt.Errorf("updateOrganizationNews: title cannot be empty")
		}
		n.Title = t
	}
	if req.Description != nil {
		n.Description = strings.TrimSpace(*req.Description)
	}
	if req.ImageURL != nil {
		n.ImageURL = strings.TrimSpace(*req.ImageURL)
	}
	if req.RichMetadata != nil {
		s := strings.TrimSpace(*req.RichMetadata)
		if s == "" {
			n.RichMetadata = nil
		} else {
			n.RichMetadata = []byte(s)
		}
	}
	n.UpdatedAt = time.Now().UTC()

	if err := uc.repo.UpdateNews(ctx, n); err != nil {
		return nil, fmt.Errorf("updateOrganizationNews: %w", err)
	}

	nick := ""
	if p, err := uc.getProfileUC.Execute(ctx, n.AuthorUserID.String()); err == nil && p != nil {
		nick = p.Nickname
	}
	var metaPtr *string
	if len(n.RichMetadata) > 0 {
		s := string(n.RichMetadata)
		metaPtr = &s
	}

	return &dto.OrganizationNewsResponse{
		ID:             n.ID.String(),
		OrganizationID: n.OrganizationID.String(),
		AuthorUserID:   n.AuthorUserID.String(),
		AuthorNickname: nick,
		Title:          n.Title,
		Description:    n.Description,
		ImageURL:       n.ImageURL,
		RichMetadata:   metaPtr,
		CreatedAt:      n.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      n.UpdatedAt.Format(time.RFC3339),
	}, nil
}
