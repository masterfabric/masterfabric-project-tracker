package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// RemoveOrganizationMemberUseCase removes a member (admin/owner). Cannot remove owner role.
type RemoveOrganizationMemberUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewRemoveOrganizationMemberUseCase constructs the use case.
func NewRemoveOrganizationMemberUseCase(repo orgRepo.OrganizationRepository) *RemoveOrganizationMemberUseCase {
	return &RemoveOrganizationMemberUseCase{repo: repo}
}

// Execute deletes membership.
func (uc *RemoveOrganizationMemberUseCase) Execute(ctx context.Context, orgID, actorID, targetID uuid.UUID) error {
	ok, err := uc.repo.IsAdminOrOwner(ctx, orgID, actorID)
	if err != nil {
		return fmt.Errorf("removeOrganizationMember: %w", err)
	}
	if !ok {
		return fmt.Errorf("removeOrganizationMember: forbidden")
	}

	org, err := uc.repo.GetByID(ctx, orgID)
	if err != nil {
		return fmt.Errorf("removeOrganizationMember: %w", err)
	}
	if org == nil {
		return fmt.Errorf("removeOrganizationMember: organization not found")
	}

	target, err := uc.repo.GetMember(ctx, orgID, targetID)
	if err != nil {
		return fmt.Errorf("removeOrganizationMember: %w", err)
	}
	if target == nil {
		return fmt.Errorf("removeOrganizationMember: member not found")
	}
	if target.Role == model.OrganizationMemberRoleOwner {
		return fmt.Errorf("removeOrganizationMember: cannot remove organization owner")
	}
	if targetID == org.OwnerUserID {
		return fmt.Errorf("removeOrganizationMember: cannot remove organization owner")
	}

	if err := uc.repo.RemoveMember(ctx, orgID, targetID); err != nil {
		return fmt.Errorf("removeOrganizationMember: %w", err)
	}
	return nil
}
