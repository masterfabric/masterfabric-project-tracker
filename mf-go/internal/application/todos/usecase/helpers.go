package usecase

import (
	"time"

	"github.com/masterfabric/masterfabric_go_basic/internal/application/todos/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/model"
)

func cloneUserTodo(t *model.UserTodo) *model.UserTodo {
	if t == nil {
		return nil
	}
	c := *t
	if t.OrganizationID != nil {
		x := *t.OrganizationID
		c.OrganizationID = &x
	}
	if t.AssignedToUserID != nil {
		x := *t.AssignedToUserID
		c.AssignedToUserID = &x
	}
	if t.DueAt != nil {
		x := *t.DueAt
		c.DueAt = &x
	}
	return &c
}

func todoToResponse(t *model.UserTodo) *dto.TodoResponse {
	resp := &dto.TodoResponse{
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
