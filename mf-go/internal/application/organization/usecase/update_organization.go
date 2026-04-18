package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// UpdateOrganizationUseCase updates org profile (admin or owner, active member).
type UpdateOrganizationUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewUpdateOrganizationUseCase constructs UpdateOrganizationUseCase.
func NewUpdateOrganizationUseCase(repo orgRepo.OrganizationRepository) *UpdateOrganizationUseCase {
	return &UpdateOrganizationUseCase{repo: repo}
}

// Execute applies partial updates.
func (uc *UpdateOrganizationUseCase) Execute(ctx context.Context, req *dto.UpdateOrganizationRequest) (*dto.OrganizationResponse, error) {
	orgID, err := uuid.Parse(req.OrganizationID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganization: invalid organization id: %w", err)
	}
	actorID, err := uuid.Parse(req.ActorUserID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganization: invalid actor id: %w", err)
	}

	ok, err := uc.repo.IsAdminOrOwner(ctx, orgID, actorID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganization: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("updateOrganization: forbidden")
	}

	o, err := uc.repo.GetByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganization: %w", err)
	}
	if o == nil {
		return nil, fmt.Errorf("updateOrganization: organization not found")
	}

	if req.Name != nil {
		o.Name = *req.Name
	}
	if req.Description != nil {
		o.Description = *req.Description
	}
	if req.LogoURL != nil {
		o.LogoURL = *req.LogoURL
	}
	if req.WebsiteURL != nil {
		o.WebsiteURL = *req.WebsiteURL
	}
	if req.ContactEmail != nil {
		o.ContactEmail = *req.ContactEmail
	}
	o.UpdatedAt = time.Now().UTC()

	if err := uc.repo.UpdateOrganization(ctx, o); err != nil {
		return nil, fmt.Errorf("updateOrganization: %w", err)
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
