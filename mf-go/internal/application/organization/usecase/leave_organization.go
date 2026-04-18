package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// LeaveOrganizationUseCase removes the authenticated user's membership unless they are org owner.
type LeaveOrganizationUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewLeaveOrganizationUseCase constructs the use case.
func NewLeaveOrganizationUseCase(repo orgRepo.OrganizationRepository) *LeaveOrganizationUseCase {
	return &LeaveOrganizationUseCase{repo: repo}
}

// Execute deletes the caller's membership row.
func (uc *LeaveOrganizationUseCase) Execute(ctx context.Context, orgID, userID uuid.UUID) error {
	org, err := uc.repo.GetByID(ctx, orgID)
	if err != nil {
		return fmt.Errorf("leaveOrganization: %w", err)
	}
	if org == nil {
		return fmt.Errorf("leaveOrganization: organization not found")
	}

	member, err := uc.repo.GetMember(ctx, orgID, userID)
	if err != nil {
		return fmt.Errorf("leaveOrganization: %w", err)
	}
	if member == nil {
		return fmt.Errorf("leaveOrganization: not a member of this organization")
	}

	if org.OwnerUserID == userID || member.Role == model.OrganizationMemberRoleOwner {
		return fmt.Errorf("leaveOrganization: organization owner cannot leave; transfer ownership first")
	}

	if err := uc.repo.RemoveMember(ctx, orgID, userID); err != nil {
		return fmt.Errorf("leaveOrganization: %w", err)
	}
	return nil
}
