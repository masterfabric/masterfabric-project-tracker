package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/push"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/todos/dto"
	iamRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/model"
	todoRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/repository"
)

// CreateTodoUseCase creates a new todo for a user.
type CreateTodoUseCase struct {
	repo     todoRepo.TodoRepository
	orgRepo  repository.OrganizationRepository
	userRepo iamRepo.UserRepository
	push     push.TodoOneSignal
}

// NewCreateTodoUseCase constructs a CreateTodoUseCase.
func NewCreateTodoUseCase(
	repo todoRepo.TodoRepository,
	orgRepo repository.OrganizationRepository,
	userRepo iamRepo.UserRepository,
	p push.TodoOneSignal,
) *CreateTodoUseCase {
	return &CreateTodoUseCase{repo: repo, orgRepo: orgRepo, userRepo: userRepo, push: p}
}

// Execute creates a new todo.
func (uc *CreateTodoUseCase) Execute(ctx context.Context, req *dto.CreateTodoRequest) (*dto.TodoResponse, error) {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, fmt.Errorf("createTodo: invalid user ID: %w", err)
	}
	if err := ensureActiveUserForTodos(ctx, uc.userRepo, userID); err != nil {
		return nil, err
	}

	title := req.Title
	if title == "" {
		return nil, fmt.Errorf("createTodo: title is required")
	}

	var orgID, assignedToID *uuid.UUID
	if req.OrganizationID != nil && *req.OrganizationID != "" {
		parsed, err := uuid.Parse(*req.OrganizationID)
		if err != nil {
			return nil, fmt.Errorf("createTodo: invalid organization ID: %w", err)
		}
		ok, err := uc.orgRepo.IsMember(ctx, parsed, userID)
		if err != nil {
			return nil, fmt.Errorf("createTodo: %w", err)
		}
		if !ok {
			return nil, fmt.Errorf("createTodo: not a member of organization")
		}
		orgID = &parsed
		if req.AssignedToUserID != nil && *req.AssignedToUserID != "" {
			assignedParsed, err := uuid.Parse(*req.AssignedToUserID)
			if err != nil {
				return nil, fmt.Errorf("createTodo: invalid assigned user ID: %w", err)
			}
			ok, err := uc.orgRepo.IsMember(ctx, parsed, assignedParsed)
			if err != nil {
				return nil, fmt.Errorf("createTodo: %w", err)
			}
			if !ok {
				return nil, fmt.Errorf("createTodo: assignee must be organization member")
			}
			assignedToID = &assignedParsed
		}
	}

	now := time.Now().UTC()
	todo := &model.UserTodo{
		ID:               uuid.New(),
		UserID:           userID,
		Title:            title,
		Completed:        req.Completed,
		OrganizationID:   orgID,
		AssignedToUserID: assignedToID,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if req.DueAt != nil && *req.DueAt != "" {
		parsed, err := time.Parse(time.RFC3339, *req.DueAt)
		if err != nil {
			return nil, fmt.Errorf("createTodo: invalid dueAt: %w", err)
		}
		u := parsed.UTC()
		todo.DueAt = &u
	}

	if err := uc.repo.Create(ctx, todo); err != nil {
		return nil, fmt.Errorf("createTodo: %w", err)
	}

	if uc.push != nil {
		uc.push.UserTodoSaved(ctx, nil, todo, userID)
	}

	return todoToResponse(todo), nil
}
