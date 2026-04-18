package push

import (
	"context"

	"github.com/google/uuid"
	orgmodel "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	todomodel "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/model"
)

// TodoOneSignal sends task assignment and due-time reminders via OneSignal REST API.
// Implementations are optional; nil means no outbound push.
type TodoOneSignal interface {
	UserTodoSaved(ctx context.Context, before, after *todomodel.UserTodo, actor uuid.UUID)
	UserTodoDeleting(ctx context.Context, todoID uuid.UUID)

	OrgProjectTodoSaved(ctx context.Context, before, after *orgmodel.OrganizationProjectTodo, actor uuid.UUID)
	OrgProjectTodoDeleting(ctx context.Context, todoID uuid.UUID)
}
