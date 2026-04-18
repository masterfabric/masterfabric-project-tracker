package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/model"
)

// TodoRepository defines persistence for user todos.
type TodoRepository interface {
	Create(ctx context.Context, t *model.UserTodo) error
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]*model.UserTodo, error)
	// ListOwnedByUserID returns todos owned by user_id (creator), for admin views.
	ListOwnedByUserID(ctx context.Context, userID uuid.UUID) ([]*model.UserTodo, error)
	GetByID(ctx context.Context, id, userID uuid.UUID) (*model.UserTodo, error)
	Update(ctx context.Context, t *model.UserTodo, actorUserID uuid.UUID) error
	Delete(ctx context.Context, id, userID uuid.UUID) error
	// AdminGetByID returns a todo by id without access checks (admin only).
	AdminGetByID(ctx context.Context, id uuid.UUID) (*model.UserTodo, error)
	// AdminUpdateTodo persists a todo row by id (admin only).
	AdminUpdateTodo(ctx context.Context, t *model.UserTodo) error
	// AdminDeleteByID removes a todo by id (admin only).
	AdminDeleteByID(ctx context.Context, id uuid.UUID) error

	// User todo subtasks (GFG-117); caller must verify parent todo access.
	ListUserTodoSubtasksByUserTodoID(ctx context.Context, userTodoID uuid.UUID) ([]*model.UserTodoSubtask, error)
	GetUserTodoSubtaskByID(ctx context.Context, id uuid.UUID) (*model.UserTodoSubtask, error)
	CountUserTodoSubtasksByUserTodoID(ctx context.Context, userTodoID uuid.UUID) (int, error)
	NextUserTodoSubtaskSortOrder(ctx context.Context, userTodoID uuid.UUID) (int, error)
	CreateUserTodoSubtask(ctx context.Context, s *model.UserTodoSubtask) error
	UpdateUserTodoSubtask(ctx context.Context, s *model.UserTodoSubtask) error
	DeleteUserTodoSubtask(ctx context.Context, id, userTodoID uuid.UUID) error
}
