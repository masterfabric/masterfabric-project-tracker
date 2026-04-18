package usecase

import (
	"time"

	todosdto "github.com/masterfabric/masterfabric_go_basic/internal/application/todos/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/model"
)

func todoModelToResponse(t *model.UserTodo) *todosdto.TodoResponse {
	resp := &todosdto.TodoResponse{
		ID:        t.ID.String(),
		UserID:    t.UserID.String(),
		Title:     t.Title,
		Completed: t.Completed,
		CreatedAt: t.CreatedAt.Format(time.RFC3339),
		UpdatedAt: t.UpdatedAt.Format(time.RFC3339),
	}
	if t.OrganizationID != nil {
		s := t.OrganizationID.String()
		resp.OrganizationID = &s
	}
	if t.AssignedToUserID != nil {
		s := t.AssignedToUserID.String()
		resp.AssignedToUserID = &s
	}
	if t.DueAt != nil {
		s := t.DueAt.UTC().Format(time.RFC3339)
		resp.DueAt = &s
	}
	return resp
}
