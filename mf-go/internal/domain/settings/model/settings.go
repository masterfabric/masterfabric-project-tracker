package model

import (
	"time"

	"github.com/google/uuid"
)

// UserSettings holds per-user preferences.
type UserSettings struct {
	ID              uuid.UUID
	UserID          uuid.UUID
	NotificationsOn bool
	Theme           string // "light" | "dark" | "system"
	Language        string // BCP-47 locale, e.g. "en", "tr"
	Timezone        string // IANA timezone, e.g. "Europe/Istanbul"
	OTPEnabled      bool   // when true, login requires OTP verification after password
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// AppSettings holds global application-level configuration (admin-managed).
type AppSettings struct {
	ID          uuid.UUID
	Key         string
	Value       string
	Description string
	IsPublic    bool // whether mobile clients can read this setting
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
