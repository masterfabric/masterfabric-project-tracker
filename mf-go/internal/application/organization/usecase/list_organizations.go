package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// ListOrganizationsUseCase returns all organizations the user belongs to.
type ListOrganizationsUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewListOrganizationsUseCase constructs a ListOrganizationsUseCase.
func NewListOrganizationsUseCase(repo orgRepo.OrganizationRepository) *ListOrganizationsUseCase {
	return &ListOrganizationsUseCase{repo: repo}
}

// Execute returns all organizations for the given user ID.
func (uc *ListOrganizationsUseCase) Execute(ctx context.Context, userID uuid.UUID) ([]*dto.OrganizationResponse, error) {
	orgs, err := uc.repo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("listOrganizations: %w", err)
	}

	result := make([]*dto.OrganizationResponse, 0, len(orgs))
	for _, o := range orgs {
		result = append(result, &dto.OrganizationResponse{
			ID:           o.ID.String(),
			Name:         o.Name,
			Description:  o.Description,
			LogoURL:      o.LogoURL,
			WebsiteURL:   o.WebsiteURL,
			ContactEmail: o.ContactEmail,
			OwnerUserID:  o.OwnerUserID.String(),
			CreatedAt:    o.CreatedAt.Format(time.RFC3339),
			UpdatedAt:    o.UpdatedAt.Format(time.RFC3339),
		})
	}

	return result, nil
}
