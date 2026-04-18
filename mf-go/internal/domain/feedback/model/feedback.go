package model

import (
	"time"

	"github.com/google/uuid"
)

// AuthorRole identifies who wrote a feedback message.
type AuthorRole string

const (
	AuthorRoleUser  AuthorRole = "USER"
	AuthorRoleAdmin AuthorRole = "ADMIN"
)

// Thread is a feedback conversation tied to a user account and/or a guest contact email.
type Thread struct {
	ID                uuid.UUID
	UserID            *uuid.UUID
	GuestContactEmail string
	Subject           string
	Status            string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// Message is one entry in a feedback thread timeline.
type Message struct {
	ID         uuid.UUID
	ThreadID   uuid.UUID
	AuthorRole AuthorRole
	Body       string
	CreatedAt  time.Time
}

// ThreadWithMessages is a thread and its messages in chronological order.
type ThreadWithMessages struct {
	Thread   Thread
	Messages []Message
}

// ThreadWithUser is admin list row: thread + owner identifiers.
type ThreadWithUser struct {
	ThreadWithMessages
	UserEmail       string
	UserDisplayName string
}
