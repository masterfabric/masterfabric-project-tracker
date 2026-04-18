package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// InviteToOrganizationUseCase handles inviting a user to an organization.
type InviteToOrganizationUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewInviteToOrganizationUseCase constructs an InviteToOrganizationUseCase.
func NewInviteToOrganizationUseCase(repo orgRepo.OrganizationRepository) *InviteToOrganizationUseCase {
	return &InviteToOrganizationUseCase{repo: repo}
}

// Execute creates a pending invitation for the given email.
func (uc *InviteToOrganizationUseCase) Execute(ctx context.Context, req *dto.InviteToOrganizationRequest) (*dto.OrganizationInvitationResponse, error) {
	orgID, err := uuid.Parse(req.OrganizationID)
	if err != nil {
		return nil, fmt.Errorf("inviteToOrganization: invalid organization ID: %w", err)
	}
	inviterID, err := uuid.Parse(req.InviterID)
	if err != nil {
		return nil, fmt.Errorf("inviteToOrganization: invalid inviter ID: %w", err)
	}

	email := strings.TrimSpace(strings.ToLower(req.InviteeEmail))
	if email == "" {
		return nil, fmt.Errorf("inviteToOrganization: invitee email is required")
	}

	ok, err := uc.repo.IsAdminOrOwner(ctx, orgID, inviterID)
	if err != nil {
		return nil, fmt.Errorf("inviteToOrganization: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("inviteToOrganization: user is not admin or owner of organization")
	}

	inv := &model.OrganizationInvitation{
		ID:             uuid.New(),
		OrganizationID: orgID,
		InviterID:      inviterID,
		InviteeEmail:   email,
		Status:         model.OrganizationInvitationStatusPending,
		CreatedAt:      time.Now().UTC(),
	}

	created, err := uc.repo.CreateInvitation(ctx, inv)
	if err != nil {
		return nil, fmt.Errorf("inviteToOrganization: %w", err)
	}

	return &dto.OrganizationInvitationResponse{
		ID:             created.ID.String(),
		OrganizationID: created.OrganizationID.String(),
		InviterID:      created.InviterID.String(),
		InviteeEmail:   created.InviteeEmail,
		Status:         string(created.Status),
		CreatedAt:      created.CreatedAt.Format(time.RFC3339),
	}, nil
}
