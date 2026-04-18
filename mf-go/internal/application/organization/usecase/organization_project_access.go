package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

func ensureOrgMember(ctx context.Context, repo orgRepo.OrganizationRepository, orgID, userID uuid.UUID) error {
	ok, err := repo.IsMember(ctx, orgID, userID)
	if err != nil {
		return fmt.Errorf("organizationProject: %w", err)
	}
	if !ok {
		return fmt.Errorf("organizationProject: not a member of this organization")
	}
	return nil
}

func ensureOrgAdminOrOwner(ctx context.Context, repo orgRepo.OrganizationRepository, orgID, userID uuid.UUID) error {
	if err := ensureOrgMember(ctx, repo, orgID, userID); err != nil {
		return err
	}
	ok, err := repo.IsAdminOrOwner(ctx, orgID, userID)
	if err != nil {
		return fmt.Errorf("organizationProject: %w", err)
	}
	if !ok {
		return fmt.Errorf("organizationProject: admin or owner role required")
	}
	return nil
}

// ensureProjectViewer loads the project; caller must be org member and either on the project roster or org admin/owner.
func ensureProjectViewer(
	ctx context.Context,
	repo orgRepo.OrganizationRepository,
	projectID, userID uuid.UUID,
) (*model.OrganizationProject, error) {
	p, err := repo.GetOrganizationProjectByID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("organizationProject: %w", err)
	}
	if p == nil {
		return nil, fmt.Errorf("organizationProject: project not found")
	}
	if err := ensureOrgMember(ctx, repo, p.OrganizationID, userID); err != nil {
		return nil, err
	}
	admin, err := repo.IsAdminOrOwner(ctx, p.OrganizationID, userID)
	if err != nil {
		return nil, fmt.Errorf("organizationProject: %w", err)
	}
	if admin {
		return p, nil
	}
	onProject, err := repo.IsOrganizationProjectMember(ctx, projectID, userID)
	if err != nil {
		return nil, fmt.Errorf("organizationProject: %w", err)
	}
	if !onProject {
		return nil, fmt.Errorf("organizationProject: not assigned to this project")
	}
	return p, nil
}

// ensureProjectTodoEditor is org admin/owner or a project roster member.
func ensureProjectTodoEditor(
	ctx context.Context,
	repo orgRepo.OrganizationRepository,
	projectID, userID uuid.UUID,
) (*model.OrganizationProject, error) {
	return ensureProjectViewer(ctx, repo, projectID, userID)
}
