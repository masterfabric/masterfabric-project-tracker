package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/push"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/todos/dto"
	iamRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
	todoRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/repository"
)

// UpdateTodoUseCase updates an existing todo.
type UpdateTodoUseCase struct {
	repo     todoRepo.TodoRepository
	orgRepo  orgRepo.OrganizationRepository
	userRepo iamRepo.UserRepository
	push     push.TodoOneSignal
}

// NewUpdateTodoUseCase constructs an UpdateTodoUseCase.
func NewUpdateTodoUseCase(
	repo todoRepo.TodoRepository,
	orgRepo orgRepo.OrganizationRepository,
	userRepo iamRepo.UserRepository,
	p push.TodoOneSignal,
) *UpdateTodoUseCase {
	return &UpdateTodoUseCase{repo: repo, orgRepo: orgRepo, userRepo: userRepo, push: p}
}

// Execute updates a todo.
func (uc *UpdateTodoUseCase) Execute(ctx context.Context, req *dto.UpdateTodoRequest) (*dto.TodoResponse, error) {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, fmt.Errorf("updateTodo: invalid user ID: %w", err)
	}
	if err := ensureActiveUserForTodos(ctx, uc.userRepo, userID); err != nil {
		return nil, err
	}

	id, err := uuid.Parse(req.ID)
	if err != nil {
		return nil, fmt.Errorf("updateTodo: invalid todo ID: %w", err)
	}

	todo, err := uc.repo.GetByID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("updateTodo: %w", err)
	}
	if todo == nil {
		return nil, fmt.Errorf("updateTodo: todo not found")
	}

	before := cloneUserTodo(todo)

	if req.Title != nil {
		todo.Title = *req.Title
	}
	if req.Completed != nil {
		todo.Completed = *req.Completed
	}
	if req.ClearOrganization != nil && *req.ClearOrganization {
		todo.OrganizationID = nil
		todo.AssignedToUserID = nil
	} else if req.OrganizationID != nil {
		if *req.OrganizationID == "" {
			todo.OrganizationID = nil
			todo.AssignedToUserID = nil
		} else {
			parsed, err := uuid.Parse(*req.OrganizationID)
			if err != nil {
				return nil, fmt.Errorf("updateTodo: invalid organization ID: %w", err)
			}
			ok, err := uc.orgRepo.IsMember(ctx, parsed, userID)
			if err != nil {
				return nil, fmt.Errorf("updateTodo: %w", err)
			}
			if !ok {
				return nil, fmt.Errorf("updateTodo: not a member of organization")
			}
			todo.OrganizationID = &parsed
		}
	}
	if req.AssignedToUserID != nil {
		if *req.AssignedToUserID == "" {
			todo.AssignedToUserID = nil
		} else {
			parsed, err := uuid.Parse(*req.AssignedToUserID)
			if err != nil {
				return nil, fmt.Errorf("updateTodo: invalid assigned user ID: %w", err)
			}
			orgID := todo.OrganizationID
			if orgID != nil {
				ok, err := uc.orgRepo.IsMember(ctx, *orgID, parsed)
				if err != nil {
					return nil, fmt.Errorf("updateTodo: %w", err)
				}
				if !ok {
					return nil, fmt.Errorf("updateTodo: assignee must be organization member")
				}
			}
			todo.AssignedToUserID = &parsed
		}
	}
	if req.ClearDueAt != nil && *req.ClearDueAt {
		todo.DueAt = nil
	} else if req.DueAt != nil {
		parsed, err := time.Parse(time.RFC3339, *req.DueAt)
		if err != nil {
			return nil, fmt.Errorf("updateTodo: invalid dueAt: %w", err)
		}
		u := parsed.UTC()
		todo.DueAt = &u
	}
	todo.UpdatedAt = time.Now().UTC()

	if err := uc.repo.Update(ctx, todo, userID); err != nil {
		return nil, fmt.Errorf("updateTodo: %w", err)
	}

	if uc.push != nil {
		uc.push.UserTodoSaved(ctx, before, todo, userID)
	}

	return todoToResponse(todo), nil
}
