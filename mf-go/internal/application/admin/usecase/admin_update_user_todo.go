package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	todosdto "github.com/masterfabric/masterfabric_go_basic/internal/application/todos/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	todorepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/repository"
)

// AdminUpdateUserTodoRequest patches a todo as admin.
type AdminUpdateUserTodoRequest struct {
	TodoID     uuid.UUID
	Title      *string
	Completed  *bool
	DueAt      *string
	ClearDueAt *bool
}

// AdminUpdateUserTodoUseCase updates title and/or completed on any todo (admin).
type AdminUpdateUserTodoUseCase struct {
	todoRepo todorepo.TodoRepository
}

func NewAdminUpdateUserTodoUseCase(todoRepo todorepo.TodoRepository) *AdminUpdateUserTodoUseCase {
	return &AdminUpdateUserTodoUseCase{todoRepo: todoRepo}
}

func (uc *AdminUpdateUserTodoUseCase) Execute(ctx context.Context, req *AdminUpdateUserTodoRequest) (*todosdto.TodoResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	t, err := uc.todoRepo.AdminGetByID(ctx, req.TodoID)
	if err != nil {
		return nil, fmt.Errorf("adminUpdateUserTodo: %w", err)
	}
	if t == nil {
		return nil, fmt.Errorf("adminUpdateUserTodo: todo not found")
	}
	if req.Title != nil {
		t.Title = *req.Title
	}
	if req.Completed != nil {
		t.Completed = *req.Completed
	}
	if req.ClearDueAt != nil && *req.ClearDueAt {
		t.DueAt = nil
	} else if req.DueAt != nil {
		parsed, err := time.Parse(time.RFC3339, *req.DueAt)
		if err != nil {
			return nil, fmt.Errorf("adminUpdateUserTodo: invalid dueAt: %w", err)
		}
		u := parsed.UTC()
		t.DueAt = &u
	}
	t.UpdatedAt = time.Now().UTC()
	if err := uc.todoRepo.AdminUpdateTodo(ctx, t); err != nil {
		return nil, fmt.Errorf("adminUpdateUserTodo: %w", err)
	}
	return todoModelToResponse(t), nil
}
