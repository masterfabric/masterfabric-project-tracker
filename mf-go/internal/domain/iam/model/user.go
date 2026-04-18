package model

import (
	"time"

	"github.com/google/uuid"
)

// UserStatus represents the lifecycle state of a user account.
type UserStatus string

const (
	UserStatusActive    UserStatus = "active"
	UserStatusInactive  UserStatus = "inactive"
	UserStatusSuspended UserStatus = "suspended"
)

// UserGender represents the user's self-identified gender.
type UserGender string

const (
	UserGenderMale           UserGender = "male"
	UserGenderFemale         UserGender = "female"
	UserGenderOther          UserGender = "other"
	UserGenderPreferNotToSay UserGender = "prefer_not_to_say"
	UserGenderUnspecified    UserGender = ""
)

// UserRole represents a user's role for access control.
type UserRole string

const (
	UserRoleAdmin     UserRole = "admin"
	UserRoleModerator UserRole = "moderator"
	UserRoleUser      UserRole = "user"
)

// DefaultRole is assigned to every newly registered user.
const DefaultRole UserRole = UserRoleUser

// UserAddress is a physical / mailing address belonging to a user.
// A user may have many addresses; at most one may be the default.
type UserAddress struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	Title        string // e.g. "Home", "Work", "Billing"
	AddressLine1 string
	AddressLine2 string
	City         string
	State        string // state or province
	PostalCode   string
	Country      string
	IsDefault    bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// User is the core identity entity. It holds only primitive/value types and
// has zero external dependencies (clean domain rule).
type User struct {
	ID           uuid.UUID
	Email        string
	PasswordHash string
	DisplayName  string
	Nickname     string
	AvatarURL    string
	Bio          string
	Status       UserStatus
	Role         UserRole
	CreatedAt    time.Time
	UpdatedAt    time.Time
	// Extended profile fields (migration 005)
	PhoneNumber    string
	DateOfBirth    *time.Time // nullable
	Gender         UserGender
	Location       string
	WebsiteURL     string
	SocialTwitter  string
	SocialGitHub   string
	SocialLinkedIn string
	Language       string
	// TelegramChatID is the numeric chat id from Telegram Bot API (user links via updateProfile).
	TelegramChatID string
}
