package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/push"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/todos/dto"
	iamRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	todoRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/repository"
)

// DeleteTodoUseCase deletes a todo.
type DeleteTodoUseCase struct {
	repo     todoRepo.TodoRepository
	userRepo iamRepo.UserRepository
	push     push.TodoOneSignal
}

// NewDeleteTodoUseCase constructs a DeleteTodoUseCase.
func NewDeleteTodoUseCase(repo todoRepo.TodoRepository, userRepo iamRepo.UserRepository, p push.TodoOneSignal) *DeleteTodoUseCase {
	return &DeleteTodoUseCase{repo: repo, userRepo: userRepo, push: p}
}

// Execute deletes a todo.
func (uc *DeleteTodoUseCase) Execute(ctx context.Context, req *dto.DeleteTodoRequest) error {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return fmt.Errorf("deleteTodo: invalid user ID: %w", err)
	}
	if err := ensureActiveUserForTodos(ctx, uc.userRepo, userID); err != nil {
		return err
	}

	id, err := uuid.Parse(req.ID)
	if err != nil {
		return fmt.Errorf("deleteTodo: invalid todo ID: %w", err)
	}

	if uc.push != nil {
		uc.push.UserTodoDeleting(ctx, id)
	}

	if err := uc.repo.Delete(ctx, id, userID); err != nil {
		return fmt.Errorf("deleteTodo: %w", err)
	}

	return nil
}
