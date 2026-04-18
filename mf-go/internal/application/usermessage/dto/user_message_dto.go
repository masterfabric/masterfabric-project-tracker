package dto

import "time"

// CreateUserMessageRequest is the input for admin creating a user message.
type CreateUserMessageRequest struct {
	UserID  string
	Message string
	Type    string // info, warning, success, error
}

// UserMessageResponse is the output for a user message.
type UserMessageResponse struct {
	ID        string
	UserID    string
	Message   string
	Type      string
	CreatedAt time.Time
	ReadAt    *time.Time
}
