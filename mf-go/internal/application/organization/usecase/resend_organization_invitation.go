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

// ResendOrganizationInvitationUseCase refreshes a pending invite (inviter + timestamp).
type ResendOrganizationInvitationUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewResendOrganizationInvitationUseCase constructs the use case.
func NewResendOrganizationInvitationUseCase(repo orgRepo.OrganizationRepository) *ResendOrganizationInvitationUseCase {
	return &ResendOrganizationInvitationUseCase{repo: repo}
}

// Execute updates inviter_id and created_at for a pending invitation.
func (uc *ResendOrganizationInvitationUseCase) Execute(ctx context.Context, invitationID, actorID uuid.UUID) (*dto.OrganizationInvitationResponse, error) {
	inv, err := uc.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return nil, fmt.Errorf("resendOrganizationInvitation: %w", err)
	}
	if inv == nil {
		return nil, fmt.Errorf("resendOrganizationInvitation: invitation not found")
	}

	ok, err := uc.repo.IsAdminOrOwner(ctx, inv.OrganizationID, actorID)
	if err != nil {
		return nil, fmt.Errorf("resendOrganizationInvitation: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("resendOrganizationInvitation: forbidden")
	}

	if inv.Status != model.OrganizationInvitationStatusPending {
		return nil, fmt.Errorf("resendOrganizationInvitation: only pending invitations can be resent")
	}

	now := time.Now().UTC()
	updated, err := uc.repo.ResendPendingInvitation(ctx, invitationID, inv.OrganizationID, actorID, now)
	if err != nil {
		return nil, fmt.Errorf("resendOrganizationInvitation: %w", err)
	}

	return &dto.OrganizationInvitationResponse{
		ID:             updated.ID.String(),
		OrganizationID: updated.OrganizationID.String(),
		InviterID:      updated.InviterID.String(),
		InviteeEmail:   updated.InviteeEmail,
		Status:         string(updated.Status),
		CreatedAt:      updated.CreatedAt.Format(time.RFC3339),
	}, nil
}
