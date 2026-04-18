package model

import (
	"time"

	"github.com/google/uuid"
)

// UserMessageType defines the snackbar type.
type UserMessageType string

const (
	UserMessageTypeInfo    UserMessageType = "info"
	UserMessageTypeWarning UserMessageType = "warning"
	UserMessageTypeSuccess UserMessageType = "success"
	UserMessageTypeError   UserMessageType = "error"
)

// UserMessage is a user-specific message from admin (snackbar on home).
type UserMessage struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	Message   string
	Type      UserMessageType
	CreatedAt time.Time
	ReadAt    *time.Time
}
