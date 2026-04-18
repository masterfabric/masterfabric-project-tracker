package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	todosdto "github.com/masterfabric/masterfabric_go_basic/internal/application/todos/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	todorepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/repository"
)

// AdminListUserOwnedTodosUseCase lists todos owned by a user (user_id = creator).
type AdminListUserOwnedTodosUseCase struct {
	todoRepo todorepo.TodoRepository
}

func NewAdminListUserOwnedTodosUseCase(todoRepo todorepo.TodoRepository) *AdminListUserOwnedTodosUseCase {
	return &AdminListUserOwnedTodosUseCase{todoRepo: todoRepo}
}

func (uc *AdminListUserOwnedTodosUseCase) Execute(ctx context.Context, targetUserID uuid.UUID) ([]*todosdto.TodoResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	todos, err := uc.todoRepo.ListOwnedByUserID(ctx, targetUserID)
	if err != nil {
		return nil, fmt.Errorf("adminListUserOwnedTodos: %w", err)
	}
	out := make([]*todosdto.TodoResponse, 0, len(todos))
	for _, t := range todos {
		out = append(out, todoModelToResponse(t))
	}
	return out, nil
}
