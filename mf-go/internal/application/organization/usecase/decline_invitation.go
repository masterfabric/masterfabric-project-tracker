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

// DeclineInvitationUseCase handles declining an organization invitation.
type DeclineInvitationUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewDeclineInvitationUseCase constructs a DeclineInvitationUseCase.
func NewDeclineInvitationUseCase(repo orgRepo.OrganizationRepository) *DeclineInvitationUseCase {
	return &DeclineInvitationUseCase{repo: repo}
}

// Execute declines the invitation.
func (uc *DeclineInvitationUseCase) Execute(ctx context.Context, req *dto.DeclineInvitationRequest) (*dto.OrganizationInvitationResponse, error) {
	invitationID, err := uuid.Parse(req.InvitationID)
	if err != nil {
		return nil, fmt.Errorf("declineInvitation: invalid invitation ID: %w", err)
	}

	inv, err := uc.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return nil, fmt.Errorf("declineInvitation: %w", err)
	}
	if inv == nil {
		return nil, fmt.Errorf("declineInvitation: invitation not found")
	}
	if inv.Status != model.OrganizationInvitationStatusPending {
		return nil, fmt.Errorf("declineInvitation: invitation is no longer pending")
	}
	if !strings.EqualFold(req.UserEmail, inv.InviteeEmail) {
		return nil, fmt.Errorf("declineInvitation: invitation was sent to a different email")
	}

	if err := uc.repo.UpdateInvitationStatus(ctx, invitationID, model.OrganizationInvitationStatusDeclined); err != nil {
		return nil, fmt.Errorf("declineInvitation: %w", err)
	}

	return &dto.OrganizationInvitationResponse{
		ID:             inv.ID.String(),
		OrganizationID: inv.OrganizationID.String(),
		InviterID:      inv.InviterID.String(),
		InviteeEmail:   inv.InviteeEmail,
		Status:         string(model.OrganizationInvitationStatusDeclined),
		CreatedAt:      inv.CreatedAt.Format(time.RFC3339),
	}, nil
}
