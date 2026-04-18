package event

import "time"

const (
	EventUserSettingsUpdated = "settings.user.updated"
	EventAppSettingsUpdated  = "settings.app.updated"
)

// UserSettingsUpdatedPayload is attached to settings change events.
type UserSettingsUpdatedPayload struct {
	UserID    string    `json:"user_id"`
	UpdatedAt time.Time `json:"updated_at"`
}
