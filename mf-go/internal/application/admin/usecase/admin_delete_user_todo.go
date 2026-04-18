package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	todorepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/repository"
)

// AdminDeleteUserTodoUseCase deletes any todo by id (admin).
type AdminDeleteUserTodoUseCase struct {
	todoRepo todorepo.TodoRepository
}

func NewAdminDeleteUserTodoUseCase(todoRepo todorepo.TodoRepository) *AdminDeleteUserTodoUseCase {
	return &AdminDeleteUserTodoUseCase{todoRepo: todoRepo}
}

func (uc *AdminDeleteUserTodoUseCase) Execute(ctx context.Context, todoID uuid.UUID) error {
	if err := policy.RequireAdmin(ctx); err != nil {
		return err
	}
	if err := uc.todoRepo.AdminDeleteByID(ctx, todoID); err != nil {
		return fmt.Errorf("adminDeleteUserTodo: %w", err)
	}
	return nil
}
