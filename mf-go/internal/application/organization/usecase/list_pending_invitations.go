package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// ListPendingInvitationsUseCase returns pending invitations for a user by email.
type ListPendingInvitationsUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewListPendingInvitationsUseCase constructs a ListPendingInvitationsUseCase.
func NewListPendingInvitationsUseCase(repo orgRepo.OrganizationRepository) *ListPendingInvitationsUseCase {
	return &ListPendingInvitationsUseCase{repo: repo}
}

// Execute returns all pending invitations for the given user email.
func (uc *ListPendingInvitationsUseCase) Execute(ctx context.Context, userEmail string) ([]*dto.OrganizationInvitationResponse, error) {
	invitations, err := uc.repo.ListPendingInvitationsByEmail(ctx, userEmail)
	if err != nil {
		return nil, fmt.Errorf("listPendingInvitations: %w", err)
	}

	result := make([]*dto.OrganizationInvitationResponse, 0, len(invitations))
	for _, inv := range invitations {
		result = append(result, &dto.OrganizationInvitationResponse{
			ID:               inv.ID.String(),
			OrganizationID:   inv.OrganizationID.String(),
			InviterID:        inv.InviterID.String(),
			InviteeEmail:     inv.InviteeEmail,
			Status:           string(inv.Status),
			CreatedAt:        inv.CreatedAt.Format(time.RFC3339),
			OrganizationName: inv.OrganizationName,
			InviterNickname:  inv.InviterNickname,
		})
	}

	return result, nil
}
