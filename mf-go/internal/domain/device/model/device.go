package model

import (
	"time"

	"github.com/google/uuid"
)

// UserDevice represents a registered device belonging to a user.
type UserDevice struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	DeviceID   string
	Platform   string
	DeviceName string
	Model      string
	Brand      string
	OSName     string
	OSVersion  string
	AppName    string
	AppVersion string
	AppBuild   string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}
