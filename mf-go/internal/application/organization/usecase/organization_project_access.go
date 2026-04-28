package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

type projectAccessRepository interface {
	GetOrganizationProjectByID(ctx context.Context, id uuid.UUID) (*model.OrganizationProject, error)
	IsMember(ctx context.Context, orgID, userID uuid.UUID) (bool, error)
	IsAdminOrOwner(ctx context.Context, orgID, userID uuid.UUID) (bool, error)
	IsOrganizationProjectMember(ctx context.Context, projectID, userID uuid.UUID) (bool, error)
	UserMayViewProjectViaAcceptedParticipation(ctx context.Context, projectID, userID uuid.UUID) (bool, error)
	UserHasProjectCapabilityViaAcceptedParticipation(ctx context.Context, projectID, userID uuid.UUID, capabilityKey string) (bool, error)
}

func ensureOrgMember(ctx context.Context, repo orgRepo.OrganizationRepository, orgID, userID uuid.UUID) error {
	ok, err := repo.IsMember(ctx, orgID, userID)
	if err != nil {
		return fmt.Errorf("organizationProject: %w", err)
	}
	if !ok {
		return domainErr.New("FORBIDDEN", "not a member of this organization", nil)
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
		return domainErr.New("FORBIDDEN", "admin or owner role required", nil)
	}
	return nil
}

// ensureProjectReader loads the project when the caller may read it: host-org path (member + admin or roster)
// or an active member of a participant organization with an accepted participation link (GFG-172 / GFG-179).
func ensureProjectReader(
	ctx context.Context,
	repo projectAccessRepository,
	projectID, userID uuid.UUID,
) (*model.OrganizationProject, error) {
	p, err := repo.GetOrganizationProjectByID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("organizationProject: %w", err)
	}
	if p == nil {
		return nil, domainErr.New("NOT_FOUND", "project not found", nil)
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
			return nil, domainErr.New("FORBIDDEN", "not assigned to this project", nil)
		}
		return p, nil
	}
	ok, err := repo.UserMayViewProjectViaAcceptedParticipation(ctx, projectID, userID)
	if err != nil {
		return nil, fmt.Errorf("organizationProject: %w", err)
	}
	if !ok {
		return nil, domainErr.New("FORBIDDEN", "not a member of this organization", nil)
	}
	return p, nil
}

// ensureProjectTodoEditor allows writes via host-org path or accepted participant-org "todos" capability.
func ensureProjectTodoEditor(
	ctx context.Context,
	repo projectAccessRepository,
	projectID, userID uuid.UUID,
) (*model.OrganizationProject, error) {
	return ensureProjectCapabilityEditor(ctx, repo, projectID, userID, "todos")
}

// ensureProjectPurchaseEditor allows writes via host-org rules or accepted participant-org purchase capability.
func ensureProjectPurchaseEditor(
	ctx context.Context,
	repo projectAccessRepository,
	projectID, userID uuid.UUID,
) (*model.OrganizationProject, error) {
	return ensureProjectCapabilityEditor(ctx, repo, projectID, userID, "purchases")
}

func ensureProjectCapabilityEditor(
	ctx context.Context,
	repo projectAccessRepository,
	projectID, userID uuid.UUID,
	capabilityKey string,
) (*model.OrganizationProject, error) {
	p, err := repo.GetOrganizationProjectByID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("organizationProject: %w", err)
	}
	if p == nil {
		return nil, domainErr.New("NOT_FOUND", "project not found", nil)
	}
	participantViewer, pvErr := repo.UserMayViewProjectViaAcceptedParticipation(ctx, projectID, userID)
	if pvErr != nil {
		return nil, fmt.Errorf("organizationProject: %w", pvErr)
	}
	if participantViewer {
		ok, capErr := repo.UserHasProjectCapabilityViaAcceptedParticipation(ctx, projectID, userID, capabilityKey)
		if capErr != nil {
			return nil, fmt.Errorf("organizationProject: %w", capErr)
		}
		if !ok {
			return nil, domainErr.New("FORBIDDEN", "not assigned to this project", nil)
		}
		return p, nil
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
			return nil, domainErr.New("FORBIDDEN", "not assigned to this project", nil)
		}
		return p, nil
	}
	ok, capErr := repo.UserHasProjectCapabilityViaAcceptedParticipation(ctx, projectID, userID, capabilityKey)
	if capErr != nil {
		return nil, fmt.Errorf("organizationProject: %w", capErr)
	}
	if !ok {
		return nil, domainErr.New("FORBIDDEN", "not assigned to this project", nil)
	}
	return p, nil
}
