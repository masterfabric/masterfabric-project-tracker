package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// SetOrganizationMemberSuspendedUseCase sets passive (suspended) state.
type SetOrganizationMemberSuspendedUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewSetOrganizationMemberSuspendedUseCase constructs the use case.
func NewSetOrganizationMemberSuspendedUseCase(repo orgRepo.OrganizationRepository) *SetOrganizationMemberSuspendedUseCase {
	return &SetOrganizationMemberSuspendedUseCase{repo: repo}
}

// Execute updates membership_status.
func (uc *SetOrganizationMemberSuspendedUseCase) Execute(ctx context.Context, orgID, actorID, targetID uuid.UUID, suspended bool) error {
	ok, err := uc.repo.IsAdminOrOwner(ctx, orgID, actorID)
	if err != nil {
		return fmt.Errorf("setOrganizationMemberSuspended: %w", err)
	}
	if !ok {
		return fmt.Errorf("setOrganizationMemberSuspended: forbidden")
	}

	org, err := uc.repo.GetByID(ctx, orgID)
	if err != nil {
		return fmt.Errorf("setOrganizationMemberSuspended: %w", err)
	}
	if org == nil {
		return fmt.Errorf("setOrganizationMemberSuspended: organization not found")
	}

	target, err := uc.repo.GetMember(ctx, orgID, targetID)
	if err != nil {
		return fmt.Errorf("setOrganizationMemberSuspended: %w", err)
	}
	if target == nil {
		return fmt.Errorf("setOrganizationMemberSuspended: member not found")
	}
	if targetID == org.OwnerUserID || target.Role == model.OrganizationMemberRoleOwner {
		return fmt.Errorf("setOrganizationMemberSuspended: cannot change owner membership status")
	}

	status := model.OrganizationMembershipActive
	if suspended {
		status = model.OrganizationMembershipSuspended
	}
	if err := uc.repo.SetMemberMembershipStatus(ctx, orgID, targetID, status); err != nil {
		return fmt.Errorf("setOrganizationMemberSuspended: %w", err)
	}
	return nil
}
