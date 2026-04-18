package dto

// CreateTodoRequest is the input for creating a todo.
type CreateTodoRequest struct {
	UserID           string
	Title            string
	Completed        bool
	OrganizationID   *string
	AssignedToUserID *string
	// DueAt is RFC3339 (UTC or offset); nil means no due time.
	DueAt *string
}

// UpdateTodoRequest is the input for updating a todo.
type UpdateTodoRequest struct {
	UserID            string
	ID                string
	Title             *string
	Completed         *bool
	OrganizationID    *string
	ClearOrganization *bool
	AssignedToUserID  *string
	// DueAt is RFC3339 when setting; ClearDueAt clears any due time.
	DueAt       *string
	ClearDueAt  *bool
}

// DeleteTodoRequest is the input for deleting a todo.
type DeleteTodoRequest struct {
	UserID string
	ID     string
}

// TodoResponse is the output for todo operations.
type TodoResponse struct {
	ID               string
	UserID           string
	Title            string
	Completed        bool
	OrganizationID   *string
	AssignedToUserID *string
	DueAt            *string
	CreatedAt        string
	UpdatedAt        string
}
