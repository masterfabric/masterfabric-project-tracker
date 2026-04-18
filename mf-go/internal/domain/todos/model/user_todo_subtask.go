package model

import (
	"time"

	"github.com/google/uuid"
)

// UserTodoSubtask is a single-level checklist item under a user todo (GFG-117).
type UserTodoSubtask struct {
	ID         uuid.UUID
	UserTodoID uuid.UUID
	Title      string
	Completed  bool
	SortOrder  int
	CreatedAt  time.Time
	UpdatedAt  time.Time
}
