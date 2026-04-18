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

// RevokeOrganizationInvitationUseCase cancels a pending invitation (admin/owner).
type RevokeOrganizationInvitationUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewRevokeOrganizationInvitationUseCase constructs the use case.
func NewRevokeOrganizationInvitationUseCase(repo orgRepo.OrganizationRepository) *RevokeOrganizationInvitationUseCase {
	return &RevokeOrganizationInvitationUseCase{repo: repo}
}

// Execute sets invitation status to revoked when it is still pending.
func (uc *RevokeOrganizationInvitationUseCase) Execute(ctx context.Context, invitationID, actorID uuid.UUID) (*dto.OrganizationInvitationResponse, error) {
	inv, err := uc.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return nil, fmt.Errorf("revokeOrganizationInvitation: %w", err)
	}
	if inv == nil {
		return nil, fmt.Errorf("revokeOrganizationInvitation: invitation not found")
	}

	ok, err := uc.repo.IsAdminOrOwner(ctx, inv.OrganizationID, actorID)
	if err != nil {
		return nil, fmt.Errorf("revokeOrganizationInvitation: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("revokeOrganizationInvitation: forbidden")
	}

	if inv.Status != model.OrganizationInvitationStatusPending {
		return nil, fmt.Errorf("revokeOrganizationInvitation: only pending invitations can be revoked")
	}

	if err := uc.repo.UpdateInvitationStatus(ctx, invitationID, model.OrganizationInvitationStatusRevoked); err != nil {
		return nil, fmt.Errorf("revokeOrganizationInvitation: %w", err)
	}

	out := *inv
	out.Status = model.OrganizationInvitationStatusRevoked
	return &dto.OrganizationInvitationResponse{
		ID:             out.ID.String(),
		OrganizationID: out.OrganizationID.String(),
		InviterID:      out.InviterID.String(),
		InviteeEmail:   out.InviteeEmail,
		Status:         string(out.Status),
		CreatedAt:      out.CreatedAt.Format(time.RFC3339),
	}, nil
}
