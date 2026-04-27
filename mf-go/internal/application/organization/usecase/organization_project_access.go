package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
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

func ensureOrgOwner(ctx context.Context, repo orgRepo.OrganizationRepository, orgID, userID uuid.UUID) error {
	org, err := repo.GetByID(ctx, orgID)
	if err != nil {
		return fmt.Errorf("organizationProject: %w", err)
	}
	if org == nil {
		return domainErr.New("NOT_FOUND", "organization not found", nil)
	}
	if org.OwnerUserID != userID {
		return domainErr.New("FORBIDDEN", "organization owner role required", nil)
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

// ensureProjectReader loads the project when the caller may read it: host-org path (member + admin or roster)
// or an active member of a participant organization with an accepted participation link (GFG-172 / GFG-179).
func ensureProjectReader(
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
	hostMember, err := repo.IsMember(ctx, p.OrganizationID, userID)
	if err != nil {
		return nil, fmt.Errorf("organizationProject: %w", err)
	}
	if hostMember {
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
	ok, err := repo.UserMayViewProjectViaAcceptedParticipation(ctx, projectID, userID)
	if err != nil {
		return nil, fmt.Errorf("organizationProject: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("organizationProject: not a member of this organization")
	}
	return p, nil
}

// ensureProjectTodoEditor is host org member and org admin/owner or on the project roster (mutations; no cross-org yet).
func ensureProjectTodoEditor(
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
