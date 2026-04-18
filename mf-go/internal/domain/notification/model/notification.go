package model

import (
	"time"

	"github.com/google/uuid"
)

// NotificationType defines the type of notification.
type NotificationType string

const (
	NotificationTypeInfo    NotificationType = "info"
	NotificationTypeWarning NotificationType = "warning"
	NotificationTypeSuccess NotificationType = "success"
	NotificationTypeError   NotificationType = "error"
)

// Notification represents a broadcast notification (admin-created).
type Notification struct {
	ID        uuid.UUID
	Title     string
	Subtitle  string
	Message   string
	Type      NotificationType
	Category  string
	Icon      string
	Language  string
	ActionURL string
	ImageURL  string
	Priority  string // high, normal, low
	CreatedAt time.Time
	UpdatedAt time.Time
}

// NotificationRead represents a user's read status for a notification.
type NotificationRead struct {
	ID             uuid.UUID
	UserID         uuid.UUID
	NotificationID uuid.UUID
	ReadAt         time.Time
}
