package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	orgModel "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

const maxProjectTodoSubtasksPerParent = 50

// ListOrganizationProjectTodoSubtasksUseCase loads subtasks for a project todo the actor may access.
type ListOrganizationProjectTodoSubtasksUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewListOrganizationProjectTodoSubtasksUseCase constructs the use case.
func NewListOrganizationProjectTodoSubtasksUseCase(repo orgRepo.OrganizationRepository) *ListOrganizationProjectTodoSubtasksUseCase {
	return &ListOrganizationProjectTodoSubtasksUseCase{repo: repo}
}

// Execute returns subtasks ordered for display.
func (uc *ListOrganizationProjectTodoSubtasksUseCase) Execute(ctx context.Context, projectTodoID, actorUserID uuid.UUID) ([]*orgModel.OrganizationProjectTodoSubtask, error) {
	parent, err := uc.repo.GetOrganizationProjectTodoByID(ctx, projectTodoID)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationProjectTodoSubtasks: %w", err)
	}
	if parent == nil {
		return nil, domainErr.New("NOT_FOUND", "project todo not found", nil)
	}
	if _, err := ensureProjectReader(ctx, uc.repo, parent.ProjectID, actorUserID); err != nil {
		return nil, err
	}
	return uc.repo.ListOrganizationProjectTodoSubtasksByParentID(ctx, projectTodoID)
}

// CreateOrganizationProjectTodoSubtaskUseCase adds a checklist item under a project todo.
type CreateOrganizationProjectTodoSubtaskUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewCreateOrganizationProjectTodoSubtaskUseCase constructs the use case.
func NewCreateOrganizationProjectTodoSubtaskUseCase(repo orgRepo.OrganizationRepository) *CreateOrganizationProjectTodoSubtaskUseCase {
	return &CreateOrganizationProjectTodoSubtaskUseCase{repo: repo}
}

// Execute creates a subtask (same visibility rules as editing the parent todo).
func (uc *CreateOrganizationProjectTodoSubtaskUseCase) Execute(ctx context.Context, projectTodoID, actorUserID uuid.UUID, title string, completed *bool) (*orgModel.OrganizationProjectTodoSubtask, error) {
	parent, err := uc.repo.GetOrganizationProjectTodoByID(ctx, projectTodoID)
	if err != nil {
		return nil, fmt.Errorf("createOrganizationProjectTodoSubtask: %w", err)
	}
	if parent == nil {
		return nil, domainErr.New("NOT_FOUND", "project todo not found", nil)
	}
	if _, err := ensureProjectTodoEditor(ctx, uc.repo, parent.ProjectID, actorUserID); err != nil {
		return nil, err
	}
	ti := strings.TrimSpace(title)
	if ti == "" {
		return nil, domainErr.New("VALIDATION_ERROR", "title is required", nil)
	}
	n, err := uc.repo.CountOrganizationProjectTodoSubtasksByParentID(ctx, projectTodoID)
	if err != nil {
		return nil, fmt.Errorf("createOrganizationProjectTodoSubtask: %w", err)
	}
	if n >= maxProjectTodoSubtasksPerParent {
		return nil, domainErr.New("VALIDATION_ERROR", "maximum subtasks per task reached", nil)
	}
	sortOrder, err := uc.repo.NextOrganizationProjectTodoSubtaskSortOrder(ctx, projectTodoID)
	if err != nil {
		return nil, fmt.Errorf("createOrganizationProjectTodoSubtask: %w", err)
	}
	done := false
	if completed != nil {
		done = *completed
	}
	now := time.Now().UTC()
	s := &orgModel.OrganizationProjectTodoSubtask{
		ID:            uuid.New(),
		ProjectTodoID: projectTodoID,
		Title:         ti,
		Completed:     done,
		SortOrder:     sortOrder,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := uc.repo.CreateOrganizationProjectTodoSubtask(ctx, s); err != nil {
		return nil, fmt.Errorf("createOrganizationProjectTodoSubtask: %w", err)
	}
	return s, nil
}

// UpdateOrganizationProjectTodoSubtaskUseCase updates a project todo subtask.
type UpdateOrganizationProjectTodoSubtaskUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewUpdateOrganizationProjectTodoSubtaskUseCase constructs the use case.
func NewUpdateOrganizationProjectTodoSubtaskUseCase(repo orgRepo.OrganizationRepository) *UpdateOrganizationProjectTodoSubtaskUseCase {
	return &UpdateOrganizationProjectTodoSubtaskUseCase{repo: repo}
}

// Execute updates title and/or completed.
func (uc *UpdateOrganizationProjectTodoSubtaskUseCase) Execute(ctx context.Context, subtaskID, actorUserID uuid.UUID, title *string, completed *bool) (*orgModel.OrganizationProjectTodoSubtask, error) {
	existing, err := uc.repo.GetOrganizationProjectTodoSubtaskByID(ctx, subtaskID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganizationProjectTodoSubtask: %w", err)
	}
	if existing == nil {
		return nil, domainErr.New("NOT_FOUND", "subtask not found", nil)
	}
	parentTodo, err := uc.repo.GetOrganizationProjectTodoByID(ctx, existing.ProjectTodoID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganizationProjectTodoSubtask: %w", err)
	}
	if parentTodo == nil {
		return nil, domainErr.New("NOT_FOUND", "project todo not found", nil)
	}
	if _, err := ensureProjectTodoEditor(ctx, uc.repo, parentTodo.ProjectID, actorUserID); err != nil {
		return nil, err
	}
	if title != nil {
		nt := strings.TrimSpace(*title)
		if nt == "" {
			return nil, domainErr.New("VALIDATION_ERROR", "title cannot be empty", nil)
		}
		existing.Title = nt
	}
	if completed != nil {
		existing.Completed = *completed
	}
	existing.UpdatedAt = time.Now().UTC()
	if err := uc.repo.UpdateOrganizationProjectTodoSubtask(ctx, existing); err != nil {
		return nil, fmt.Errorf("updateOrganizationProjectTodoSubtask: %w", err)
	}
	return existing, nil
}

// DeleteOrganizationProjectTodoSubtaskUseCase removes a project todo subtask.
type DeleteOrganizationProjectTodoSubtaskUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewDeleteOrganizationProjectTodoSubtaskUseCase constructs the use case.
func NewDeleteOrganizationProjectTodoSubtaskUseCase(repo orgRepo.OrganizationRepository) *DeleteOrganizationProjectTodoSubtaskUseCase {
	return &DeleteOrganizationProjectTodoSubtaskUseCase{repo: repo}
}

// Execute deletes after verifying project todo editor access.
func (uc *DeleteOrganizationProjectTodoSubtaskUseCase) Execute(ctx context.Context, subtaskID, actorUserID uuid.UUID) error {
	existing, err := uc.repo.GetOrganizationProjectTodoSubtaskByID(ctx, subtaskID)
	if err != nil {
		return fmt.Errorf("deleteOrganizationProjectTodoSubtask: %w", err)
	}
	if existing == nil {
		return domainErr.New("NOT_FOUND", "subtask not found", nil)
	}
	parentTodo, err := uc.repo.GetOrganizationProjectTodoByID(ctx, existing.ProjectTodoID)
	if err != nil {
		return fmt.Errorf("deleteOrganizationProjectTodoSubtask: %w", err)
	}
	if parentTodo == nil {
		return domainErr.New("NOT_FOUND", "project todo not found", nil)
	}
	if _, err := ensureProjectTodoEditor(ctx, uc.repo, parentTodo.ProjectID, actorUserID); err != nil {
		return err
	}
	if err := uc.repo.DeleteOrganizationProjectTodoSubtask(ctx, subtaskID, existing.ProjectTodoID); err != nil {
		return fmt.Errorf("deleteOrganizationProjectTodoSubtask: %w", err)
	}
	return nil
}
