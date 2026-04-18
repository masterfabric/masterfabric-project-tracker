package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	todoModel "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/model"
	todoRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

const maxUserTodoSubtasksPerParent = 50

// ListUserTodoSubtasksUseCase loads checklist items for a user todo the actor may access.
type ListUserTodoSubtasksUseCase struct {
	repo todoRepo.TodoRepository
}

// NewListUserTodoSubtasksUseCase constructs ListUserTodoSubtasksUseCase.
func NewListUserTodoSubtasksUseCase(repo todoRepo.TodoRepository) *ListUserTodoSubtasksUseCase {
	return &ListUserTodoSubtasksUseCase{repo: repo}
}

// Execute returns subtasks ordered for display, or an error if the parent todo is not visible to the actor.
func (uc *ListUserTodoSubtasksUseCase) Execute(ctx context.Context, userTodoID, actorUserID uuid.UUID) ([]*todoModel.UserTodoSubtask, error) {
	parent, err := uc.repo.GetByID(ctx, userTodoID, actorUserID)
	if err != nil {
		return nil, fmt.Errorf("listUserTodoSubtasks: %w", err)
	}
	if parent == nil {
		return nil, domainErr.New("FORBIDDEN", "todo not found or access denied", nil)
	}
	return uc.repo.ListUserTodoSubtasksByUserTodoID(ctx, userTodoID)
}

// CreateUserTodoSubtaskUseCase adds a checklist item under a user todo.
type CreateUserTodoSubtaskUseCase struct {
	repo todoRepo.TodoRepository
}

// NewCreateUserTodoSubtaskUseCase constructs CreateUserTodoSubtaskUseCase.
func NewCreateUserTodoSubtaskUseCase(repo todoRepo.TodoRepository) *CreateUserTodoSubtaskUseCase {
	return &CreateUserTodoSubtaskUseCase{repo: repo}
}

// Execute creates a subtask; actor must have the same access as for the parent todo.
func (uc *CreateUserTodoSubtaskUseCase) Execute(ctx context.Context, userTodoID, actorUserID uuid.UUID, title string, completed *bool) (*todoModel.UserTodoSubtask, error) {
	parent, err := uc.repo.GetByID(ctx, userTodoID, actorUserID)
	if err != nil {
		return nil, fmt.Errorf("createUserTodoSubtask: %w", err)
	}
	if parent == nil {
		return nil, domainErr.New("FORBIDDEN", "todo not found or access denied", nil)
	}
	ti := strings.TrimSpace(title)
	if ti == "" {
		return nil, domainErr.New("VALIDATION_ERROR", "title is required", nil)
	}
	n, err := uc.repo.CountUserTodoSubtasksByUserTodoID(ctx, userTodoID)
	if err != nil {
		return nil, fmt.Errorf("createUserTodoSubtask: %w", err)
	}
	if n >= maxUserTodoSubtasksPerParent {
		return nil, domainErr.New("VALIDATION_ERROR", "maximum subtasks per task reached", nil)
	}
	sortOrder, err := uc.repo.NextUserTodoSubtaskSortOrder(ctx, userTodoID)
	if err != nil {
		return nil, fmt.Errorf("createUserTodoSubtask: %w", err)
	}
	done := false
	if completed != nil {
		done = *completed
	}
	now := time.Now().UTC()
	s := &todoModel.UserTodoSubtask{
		ID:         uuid.New(),
		UserTodoID: userTodoID,
		Title:      ti,
		Completed:  done,
		SortOrder:  sortOrder,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := uc.repo.CreateUserTodoSubtask(ctx, s); err != nil {
		return nil, fmt.Errorf("createUserTodoSubtask: %w", err)
	}
	return s, nil
}

// UpdateUserTodoSubtaskUseCase updates title and/or completed on a subtask.
type UpdateUserTodoSubtaskUseCase struct {
	repo todoRepo.TodoRepository
}

// NewUpdateUserTodoSubtaskUseCase constructs UpdateUserTodoSubtaskUseCase.
func NewUpdateUserTodoSubtaskUseCase(repo todoRepo.TodoRepository) *UpdateUserTodoSubtaskUseCase {
	return &UpdateUserTodoSubtaskUseCase{repo: repo}
}

// Execute updates a subtask after verifying parent todo access.
func (uc *UpdateUserTodoSubtaskUseCase) Execute(ctx context.Context, subtaskID, actorUserID uuid.UUID, title *string, completed *bool) (*todoModel.UserTodoSubtask, error) {
	existing, err := uc.repo.GetUserTodoSubtaskByID(ctx, subtaskID)
	if err != nil {
		return nil, fmt.Errorf("updateUserTodoSubtask: %w", err)
	}
	if existing == nil {
		return nil, domainErr.New("NOT_FOUND", "subtask not found", nil)
	}
	parent, err := uc.repo.GetByID(ctx, existing.UserTodoID, actorUserID)
	if err != nil {
		return nil, fmt.Errorf("updateUserTodoSubtask: %w", err)
	}
	if parent == nil {
		return nil, domainErr.New("FORBIDDEN", "todo not found or access denied", nil)
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
	if err := uc.repo.UpdateUserTodoSubtask(ctx, existing); err != nil {
		return nil, fmt.Errorf("updateUserTodoSubtask: %w", err)
	}
	return existing, nil
}

// DeleteUserTodoSubtaskUseCase removes a checklist item.
type DeleteUserTodoSubtaskUseCase struct {
	repo todoRepo.TodoRepository
}

// NewDeleteUserTodoSubtaskUseCase constructs DeleteUserTodoSubtaskUseCase.
func NewDeleteUserTodoSubtaskUseCase(repo todoRepo.TodoRepository) *DeleteUserTodoSubtaskUseCase {
	return &DeleteUserTodoSubtaskUseCase{repo: repo}
}

// Execute deletes a subtask after verifying parent access.
func (uc *DeleteUserTodoSubtaskUseCase) Execute(ctx context.Context, subtaskID, actorUserID uuid.UUID) error {
	existing, err := uc.repo.GetUserTodoSubtaskByID(ctx, subtaskID)
	if err != nil {
		return fmt.Errorf("deleteUserTodoSubtask: %w", err)
	}
	if existing == nil {
		return domainErr.New("NOT_FOUND", "subtask not found", nil)
	}
	parent, err := uc.repo.GetByID(ctx, existing.UserTodoID, actorUserID)
	if err != nil {
		return fmt.Errorf("deleteUserTodoSubtask: %w", err)
	}
	if parent == nil {
		return domainErr.New("FORBIDDEN", "todo not found or access denied", nil)
	}
	if err := uc.repo.DeleteUserTodoSubtask(ctx, subtaskID, existing.UserTodoID); err != nil {
		return fmt.Errorf("deleteUserTodoSubtask: %w", err)
	}
	return nil
}
