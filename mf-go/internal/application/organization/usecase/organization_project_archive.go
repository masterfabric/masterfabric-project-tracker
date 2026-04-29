package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

type ListArchivedOrganizationProjectsUseCase struct{ repo orgRepo.OrganizationRepository }

func NewListArchivedOrganizationProjectsUseCase(repo orgRepo.OrganizationRepository) *ListArchivedOrganizationProjectsUseCase {
	return &ListArchivedOrganizationProjectsUseCase{repo: repo}
}

func (uc *ListArchivedOrganizationProjectsUseCase) Execute(ctx context.Context, orgID, callerUserID uuid.UUID) ([]*dto.OrganizationProjectResponse, error) {
	if err := ensureOrgMember(ctx, uc.repo, orgID, callerUserID); err != nil {
		return nil, err
	}
	admin, err := uc.repo.IsAdminOrOwner(ctx, orgID, callerUserID)
	if err != nil {
		return nil, fmt.Errorf("listArchivedOrganizationProjects: %w", err)
	}
	var rows []*dto.OrganizationProjectResponse
	if admin {
		ps, err := uc.repo.ListArchivedOrganizationProjectsByOrgID(ctx, orgID)
		if err != nil {
			return nil, fmt.Errorf("listArchivedOrganizationProjects: %w", err)
		}
		rows = make([]*dto.OrganizationProjectResponse, 0, len(ps))
		for _, p := range ps {
			rows = append(rows, organizationProjectToDTO(p))
		}
		return rows, nil
	}
	ps, err := uc.repo.ListArchivedOrganizationProjectsForOrgMember(ctx, orgID, callerUserID)
	if err != nil {
		return nil, fmt.Errorf("listArchivedOrganizationProjects: %w", err)
	}
	rows = make([]*dto.OrganizationProjectResponse, 0, len(ps))
	for _, p := range ps {
		rows = append(rows, organizationProjectToDTO(p))
	}
	return rows, nil
}

type ArchiveOrganizationProjectUseCase struct{ repo orgRepo.OrganizationRepository }

func NewArchiveOrganizationProjectUseCase(repo orgRepo.OrganizationRepository) *ArchiveOrganizationProjectUseCase {
	return &ArchiveOrganizationProjectUseCase{repo: repo}
}

func (uc *ArchiveOrganizationProjectUseCase) Execute(ctx context.Context, projectID, actorUserID uuid.UUID) error {
	p, err := uc.repo.GetOrganizationProjectByIDAnyState(ctx, projectID)
	if err != nil {
		return fmt.Errorf("archiveOrganizationProject: %w", err)
	}
	if p == nil {
		return fmt.Errorf("archiveOrganizationProject: project not found")
	}
	if err := ensureOrgAdminOrOwner(ctx, uc.repo, p.OrganizationID, actorUserID); err != nil {
		return err
	}
	if err := uc.repo.ArchiveOrganizationProjectByID(ctx, projectID); err != nil {
		return fmt.Errorf("archiveOrganizationProject: %w", err)
	}
	return nil
}

type UnarchiveOrganizationProjectUseCase struct{ repo orgRepo.OrganizationRepository }

func NewUnarchiveOrganizationProjectUseCase(repo orgRepo.OrganizationRepository) *UnarchiveOrganizationProjectUseCase {
	return &UnarchiveOrganizationProjectUseCase{repo: repo}
}

func (uc *UnarchiveOrganizationProjectUseCase) Execute(ctx context.Context, projectID, actorUserID uuid.UUID) error {
	p, err := uc.repo.GetOrganizationProjectByIDAnyState(ctx, projectID)
	if err != nil {
		return fmt.Errorf("unarchiveOrganizationProject: %w", err)
	}
	if p == nil {
		return fmt.Errorf("unarchiveOrganizationProject: project not found")
	}
	if err := ensureOrgAdminOrOwner(ctx, uc.repo, p.OrganizationID, actorUserID); err != nil {
		return err
	}
	if err := uc.repo.UnarchiveOrganizationProjectByID(ctx, projectID); err != nil {
		return fmt.Errorf("unarchiveOrganizationProject: %w", err)
	}
	return nil
}

type ListArchivedOrganizationProjectTodosUseCase struct{ repo orgRepo.OrganizationRepository }

func NewListArchivedOrganizationProjectTodosUseCase(repo orgRepo.OrganizationRepository) *ListArchivedOrganizationProjectTodosUseCase {
	return &ListArchivedOrganizationProjectTodosUseCase{repo: repo}
}

func (uc *ListArchivedOrganizationProjectTodosUseCase) Execute(ctx context.Context, projectID, callerUserID uuid.UUID) ([]*dto.OrganizationProjectTodoResponse, error) {
	if _, err := ensureProjectReader(ctx, uc.repo, projectID, callerUserID); err != nil {
		return nil, err
	}
	rows, err := uc.repo.ListArchivedOrganizationProjectTodos(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("listArchivedOrganizationProjectTodos: %w", err)
	}
	out := make([]*dto.OrganizationProjectTodoResponse, 0, len(rows))
	for _, t := range rows {
		out = append(out, organizationProjectTodoToDTO(t))
	}
	return out, nil
}

type ArchiveOrganizationProjectTodoUseCase struct{ repo orgRepo.OrganizationRepository }

func NewArchiveOrganizationProjectTodoUseCase(repo orgRepo.OrganizationRepository) *ArchiveOrganizationProjectTodoUseCase {
	return &ArchiveOrganizationProjectTodoUseCase{repo: repo}
}

func (uc *ArchiveOrganizationProjectTodoUseCase) Execute(ctx context.Context, todoID, actorUserID uuid.UUID) error {
	existing, err := uc.repo.GetOrganizationProjectTodoByIDAnyState(ctx, todoID)
	if err != nil {
		return fmt.Errorf("archiveOrganizationProjectTodo: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("archiveOrganizationProjectTodo: todo not found")
	}
	if _, err := ensureProjectTodoEditor(ctx, uc.repo, existing.ProjectID, actorUserID); err != nil {
		return err
	}
	if err := uc.repo.ArchiveOrganizationProjectTodoByID(ctx, todoID); err != nil {
		return fmt.Errorf("archiveOrganizationProjectTodo: %w", err)
	}
	return nil
}

type UnarchiveOrganizationProjectTodoUseCase struct{ repo orgRepo.OrganizationRepository }

func NewUnarchiveOrganizationProjectTodoUseCase(repo orgRepo.OrganizationRepository) *UnarchiveOrganizationProjectTodoUseCase {
	return &UnarchiveOrganizationProjectTodoUseCase{repo: repo}
}

func (uc *UnarchiveOrganizationProjectTodoUseCase) Execute(ctx context.Context, todoID, actorUserID uuid.UUID) error {
	existing, err := uc.repo.GetOrganizationProjectTodoByIDAnyState(ctx, todoID)
	if err != nil {
		return fmt.Errorf("unarchiveOrganizationProjectTodo: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("unarchiveOrganizationProjectTodo: todo not found")
	}
	if _, err := ensureProjectTodoEditor(ctx, uc.repo, existing.ProjectID, actorUserID); err != nil {
		return err
	}
	if err := uc.repo.UnarchiveOrganizationProjectTodoByID(ctx, todoID); err != nil {
		return fmt.Errorf("unarchiveOrganizationProjectTodo: %w", err)
	}
	return nil
}
