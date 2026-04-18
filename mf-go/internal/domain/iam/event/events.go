package event

import "time"

// IAM domain event types
const (
	EventUserRegistered = "iam.user.registered"
	EventUserLoggedIn   = "iam.user.login"
	EventUserLoggedOut  = "iam.user.logout"
	EventUserUpdated    = "iam.user.updated"
	EventUserDeleted    = "iam.user.deleted"
)

// UserRegisteredPayload is the data attached to the UserRegistered event.
type UserRegisteredPayload struct {
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

// UserLoggedInPayload is the data attached to the UserLoggedIn event.
type UserLoggedInPayload struct {
	UserID   string    `json:"user_id"`
	Email    string    `json:"email"`
	LoggedAt time.Time `json:"logged_at"`
}
