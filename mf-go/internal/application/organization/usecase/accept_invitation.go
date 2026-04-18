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

// AcceptInvitationUseCase handles accepting an organization invitation.
type AcceptInvitationUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewAcceptInvitationUseCase constructs an AcceptInvitationUseCase.
func NewAcceptInvitationUseCase(repo orgRepo.OrganizationRepository) *AcceptInvitationUseCase {
	return &AcceptInvitationUseCase{repo: repo}
}

// Execute accepts the invitation and adds the user as a member.
func (uc *AcceptInvitationUseCase) Execute(ctx context.Context, req *dto.AcceptInvitationRequest) (*dto.OrganizationInvitationResponse, error) {
	invitationID, err := uuid.Parse(req.InvitationID)
	if err != nil {
		return nil, fmt.Errorf("acceptInvitation: invalid invitation ID: %w", err)
	}
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, fmt.Errorf("acceptInvitation: invalid user ID: %w", err)
	}

	inv, err := uc.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return nil, fmt.Errorf("acceptInvitation: %w", err)
	}
	if inv == nil {
		return nil, fmt.Errorf("acceptInvitation: invitation not found")
	}
	if inv.Status != model.OrganizationInvitationStatusPending {
		return nil, fmt.Errorf("acceptInvitation: invitation is no longer pending")
	}

	userEmail := req.UserEmail
	if userEmail == "" {
		userEmail = inv.InviteeEmail
	}
	if !strings.EqualFold(userEmail, inv.InviteeEmail) {
		return nil, fmt.Errorf("acceptInvitation: invitation was sent to a different email")
	}

	if err := uc.repo.UpdateInvitationStatus(ctx, invitationID, model.OrganizationInvitationStatusAccepted); err != nil {
		return nil, fmt.Errorf("acceptInvitation: %w", err)
	}

	member := &model.OrganizationMember{
		ID:               uuid.New(),
		OrganizationID:   inv.OrganizationID,
		UserID:           userID,
		Role:             model.OrganizationMemberRoleMember,
		MembershipStatus: model.OrganizationMembershipActive,
		JoinedAt:         time.Now().UTC(),
	}
	if err := uc.repo.AddMember(ctx, member); err != nil {
		return nil, fmt.Errorf("acceptInvitation: add member: %w", err)
	}

	return &dto.OrganizationInvitationResponse{
		ID:             inv.ID.String(),
		OrganizationID: inv.OrganizationID.String(),
		InviterID:      inv.InviterID.String(),
		InviteeEmail:   inv.InviteeEmail,
		Status:         string(model.OrganizationInvitationStatusAccepted),
		CreatedAt:      inv.CreatedAt.Format(time.RFC3339),
	}, nil
}
