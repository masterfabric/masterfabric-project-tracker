package usecase

import (
	"context"

	"github.com/google/uuid"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// DeleteOrganizationMessageUseCase removes an org chat message (owner only).
type DeleteOrganizationMessageUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewDeleteOrganizationMessageUseCase constructs the use case.
func NewDeleteOrganizationMessageUseCase(repo orgRepo.OrganizationRepository) *DeleteOrganizationMessageUseCase {
	return &DeleteOrganizationMessageUseCase{repo: repo}
}

// Execute deletes messageId within organizationId when actorID is the org owner.
func (uc *DeleteOrganizationMessageUseCase) Execute(ctx context.Context, orgID, messageID, actorID uuid.UUID) error {
	m, err := uc.repo.GetMessageByID(ctx, messageID)
	if err != nil {
		return domainErr.New("INTERNAL_ERROR", "failed to load message", err)
	}
	if m == nil {
		return domainErr.New("NOT_FOUND", "message not found", nil)
	}
	if m.OrganizationID != orgID {
		return domainErr.New("FORBIDDEN", "message does not belong to this organization", nil)
	}

	org, err := uc.repo.GetByID(ctx, orgID)
	if err != nil {
		return domainErr.New("INTERNAL_ERROR", "failed to load organization", err)
	}
	if org == nil {
		return domainErr.New("NOT_FOUND", "organization not found", nil)
	}
	if org.OwnerUserID != actorID {
		return domainErr.New("FORBIDDEN", "only the organization owner can delete chat messages", nil)
	}

	if err := uc.repo.DeleteMessage(ctx, orgID, messageID); err != nil {
		return domainErr.New("INTERNAL_ERROR", "failed to delete message", err)
	}
	return nil
}
