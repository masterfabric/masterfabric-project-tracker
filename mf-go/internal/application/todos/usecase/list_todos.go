package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/todos/dto"
	iamRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	todoRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/repository"
)

// ListTodosUseCase returns all todos for a user.
type ListTodosUseCase struct {
	repo     todoRepo.TodoRepository
	userRepo iamRepo.UserRepository
}

// NewListTodosUseCase constructs a ListTodosUseCase.
func NewListTodosUseCase(repo todoRepo.TodoRepository, userRepo iamRepo.UserRepository) *ListTodosUseCase {
	return &ListTodosUseCase{repo: repo, userRepo: userRepo}
}

// Execute returns all todos for the given user ID.
func (uc *ListTodosUseCase) Execute(ctx context.Context, userID uuid.UUID) ([]*dto.TodoResponse, error) {
	if err := ensureActiveUserForTodos(ctx, uc.userRepo, userID); err != nil {
		return nil, err
	}

	todos, err := uc.repo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("listTodos: %w", err)
	}

	result := make([]*dto.TodoResponse, 0, len(todos))
	for _, t := range todos {
		result = append(result, todoToResponse(t))
	}

	return result, nil
}
