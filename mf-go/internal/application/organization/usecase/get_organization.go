package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// GetOrganizationUseCase returns one organization if the caller is an active member.
type GetOrganizationUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewGetOrganizationUseCase constructs GetOrganizationUseCase.
func NewGetOrganizationUseCase(repo orgRepo.OrganizationRepository) *GetOrganizationUseCase {
	return &GetOrganizationUseCase{repo: repo}
}

// Execute loads the organization by ID.
func (uc *GetOrganizationUseCase) Execute(ctx context.Context, orgID uuid.UUID, callerUserID uuid.UUID) (*dto.OrganizationResponse, error) {
	ok, err := uc.repo.IsMember(ctx, orgID, callerUserID)
	if err != nil {
		return nil, fmt.Errorf("getOrganization: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("getOrganization: not a member of this organization")
	}

	o, err := uc.repo.GetByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("getOrganization: %w", err)
	}
	if o == nil {
		return nil, fmt.Errorf("getOrganization: organization not found")
	}

	return &dto.OrganizationResponse{
		ID:           o.ID.String(),
		Name:         o.Name,
		Description:  o.Description,
		LogoURL:      o.LogoURL,
		WebsiteURL:   o.WebsiteURL,
		ContactEmail: o.ContactEmail,
		OwnerUserID:  o.OwnerUserID.String(),
		CreatedAt:    o.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    o.UpdatedAt.Format(time.RFC3339),
	}, nil
}
