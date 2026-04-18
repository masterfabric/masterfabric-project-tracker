package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	userUC "github.com/masterfabric/masterfabric_go_basic/internal/application/user/usecase"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// CreateOrganizationNewsUseCase creates a post (organization owner only).
type CreateOrganizationNewsUseCase struct {
	repo         orgRepo.OrganizationRepository
	getProfileUC *userUC.GetProfileUseCase
}

// NewCreateOrganizationNewsUseCase constructs the use case.
func NewCreateOrganizationNewsUseCase(repo orgRepo.OrganizationRepository, getProfileUC *userUC.GetProfileUseCase) *CreateOrganizationNewsUseCase {
	return &CreateOrganizationNewsUseCase{repo: repo, getProfileUC: getProfileUC}
}

// Execute inserts news.
func (uc *CreateOrganizationNewsUseCase) Execute(ctx context.Context, req *dto.CreateOrganizationNewsRequest) (*dto.OrganizationNewsResponse, error) {
	orgID, err := uuid.Parse(req.OrganizationID)
	if err != nil {
		return nil, fmt.Errorf("createOrganizationNews: invalid org id: %w", err)
	}
	actorID, err := uuid.Parse(req.ActorUserID)
	if err != nil {
		return nil, fmt.Errorf("createOrganizationNews: invalid actor: %w", err)
	}

	org, err := uc.repo.GetByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("createOrganizationNews: %w", err)
	}
	if org == nil {
		return nil, fmt.Errorf("createOrganizationNews: organization not found")
	}
	if org.OwnerUserID != actorID {
		return nil, fmt.Errorf("createOrganizationNews: only organization owner can post news")
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, fmt.Errorf("createOrganizationNews: title is required")
	}

	var metaBytes []byte
	if req.RichMetadata != nil && strings.TrimSpace(*req.RichMetadata) != "" {
		metaBytes = []byte(strings.TrimSpace(*req.RichMetadata))
	}

	now := time.Now().UTC()
	n := &model.OrganizationNews{
		ID:             uuid.New(),
		OrganizationID: orgID,
		AuthorUserID:   actorID,
		Title:          title,
		Description:    strings.TrimSpace(req.Description),
		ImageURL:       strings.TrimSpace(req.ImageURL),
		RichMetadata:   metaBytes,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := uc.repo.CreateNews(ctx, n); err != nil {
		return nil, fmt.Errorf("createOrganizationNews: %w", err)
	}

	nick := ""
	if p, err := uc.getProfileUC.Execute(ctx, actorID.String()); err == nil && p != nil {
		nick = p.Nickname
	}
	var metaPtr *string
	if len(metaBytes) > 0 {
		s := string(metaBytes)
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
