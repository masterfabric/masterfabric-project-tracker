package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// DeleteOrganizationNewsUseCase deletes a post (org owner only).
type DeleteOrganizationNewsUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewDeleteOrganizationNewsUseCase constructs the use case.
func NewDeleteOrganizationNewsUseCase(repo orgRepo.OrganizationRepository) *DeleteOrganizationNewsUseCase {
	return &DeleteOrganizationNewsUseCase{repo: repo}
}

// Execute deletes by id.
func (uc *DeleteOrganizationNewsUseCase) Execute(ctx context.Context, newsID uuid.UUID, actorID uuid.UUID) error {
	n, err := uc.repo.GetNewsByID(ctx, newsID)
	if err != nil {
		return fmt.Errorf("deleteOrganizationNews: %w", err)
	}
	if n == nil {
		return fmt.Errorf("deleteOrganizationNews: not found")
	}

	org, err := uc.repo.GetByID(ctx, n.OrganizationID)
	if err != nil || org == nil {
		return fmt.Errorf("deleteOrganizationNews: organization not found")
	}
	if org.OwnerUserID != actorID {
		return fmt.Errorf("deleteOrganizationNews: only organization owner can delete news")
	}

	if err := uc.repo.DeleteNews(ctx, newsID); err != nil {
		return fmt.Errorf("deleteOrganizationNews: %w", err)
	}
	return nil
}
