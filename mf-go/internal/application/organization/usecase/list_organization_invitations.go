package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// ListOrganizationInvitationsUseCase returns all invitations for an organization.
// Caller must be admin or owner of the organization.
type ListOrganizationInvitationsUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewListOrganizationInvitationsUseCase constructs a ListOrganizationInvitationsUseCase.
func NewListOrganizationInvitationsUseCase(repo orgRepo.OrganizationRepository) *ListOrganizationInvitationsUseCase {
	return &ListOrganizationInvitationsUseCase{repo: repo}
}

// ListOrganizationInvitationsRequest is the input for listing organization invitations.
type ListOrganizationInvitationsRequest struct {
	OrganizationID string
	UserID         string
}

// Execute returns all invitations for the organization if the user is admin or owner.
func (uc *ListOrganizationInvitationsUseCase) Execute(ctx context.Context, req *ListOrganizationInvitationsRequest) ([]*dto.OrganizationInvitationResponse, error) {
	orgID, err := uuid.Parse(req.OrganizationID)
	if err != nil {
		return nil, domainErr.New("INVALID_INPUT", "invalid organization id", err)
	}
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, domainErr.New("INVALID_INPUT", "invalid user id", err)
	}

	ok, err := uc.repo.IsAdminOrOwner(ctx, orgID, userID)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationInvitations: %w", err)
	}
	if !ok {
		return nil, domainErr.New("FORBIDDEN", "must be admin or owner to view invitations", nil)
	}

	invitations, err := uc.repo.ListInvitationsByOrganizationID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationInvitations: %w", err)
	}

	result := make([]*dto.OrganizationInvitationResponse, 0, len(invitations))
	for _, inv := range invitations {
		result = append(result, &dto.OrganizationInvitationResponse{
			ID:             inv.ID.String(),
			OrganizationID: inv.OrganizationID.String(),
			InviterID:      inv.InviterID.String(),
			InviteeEmail:   inv.InviteeEmail,
			Status:         string(inv.Status),
			CreatedAt:      inv.CreatedAt.Format(time.RFC3339),
		})
	}
	return result, nil
}
