package model

import (
	"time"

	"github.com/google/uuid"
)

// UserTodo represents a todo item belonging to a user.
type UserTodo struct {
	ID               uuid.UUID
	UserID           uuid.UUID
	Title            string
	Completed        bool
	ArchivedAt       *time.Time
	OrganizationID   *uuid.UUID
	AssignedToUserID *uuid.UUID
	DueAt            *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}
