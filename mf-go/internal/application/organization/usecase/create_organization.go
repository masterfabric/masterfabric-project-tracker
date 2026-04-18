package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// CreateOrganizationUseCase handles creating a new organization.
type CreateOrganizationUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewCreateOrganizationUseCase constructs a CreateOrganizationUseCase.
func NewCreateOrganizationUseCase(repo orgRepo.OrganizationRepository) *CreateOrganizationUseCase {
	return &CreateOrganizationUseCase{repo: repo}
}

// Execute creates an organization and adds the creator as owner.
func (uc *CreateOrganizationUseCase) Execute(ctx context.Context, req *dto.CreateOrganizationRequest) (*dto.OrganizationResponse, error) {
	ownerID, err := uuid.Parse(req.OwnerUserID)
	if err != nil {
		return nil, fmt.Errorf("createOrganization: invalid owner ID: %w", err)
	}

	now := time.Now().UTC()
	org := &model.Organization{
		ID:          uuid.New(),
		Name:        req.Name,
		OwnerUserID: ownerID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := uc.repo.Create(ctx, org); err != nil {
		return nil, fmt.Errorf("createOrganization: %w", err)
	}

	member := &model.OrganizationMember{
		ID:               uuid.New(),
		OrganizationID:   org.ID,
		UserID:           ownerID,
		Role:             model.OrganizationMemberRoleOwner,
		MembershipStatus: model.OrganizationMembershipActive,
		JoinedAt:         now,
	}
	if err := uc.repo.AddMember(ctx, member); err != nil {
		return nil, fmt.Errorf("createOrganization: add owner member: %w", err)
	}

	return &dto.OrganizationResponse{
		ID:           org.ID.String(),
		Name:         org.Name,
		Description:  org.Description,
		LogoURL:      org.LogoURL,
		WebsiteURL:   org.WebsiteURL,
		ContactEmail: org.ContactEmail,
		OwnerUserID:  org.OwnerUserID.String(),
		CreatedAt:    org.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    org.UpdatedAt.Format(time.RFC3339),
	}, nil
}
