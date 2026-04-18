package dto

// UserSettingsRequest is the input for updating user settings.
type UserSettingsRequest struct {
	UserID          string  `validate:"required,uuid4"`
	NotificationsOn *bool   `json:"notifications_on,omitempty"`
	Theme           *string `validate:"omitempty,oneof=light dark system" json:"theme,omitempty"`
	Language        *string `validate:"omitempty,bcp47_language_tag" json:"language,omitempty"`
	Timezone        *string `json:"timezone,omitempty"`
	OTPEnabled      *bool   `json:"otp_enabled,omitempty"`
}

// UserSettingsResponse is returned to the client.
type UserSettingsResponse struct {
	UserID          string `json:"user_id"`
	NotificationsOn bool   `json:"notifications_on"`
	Theme           string `json:"theme"`
	Language        string `json:"language"`
	Timezone        string `json:"timezone"`
	OTPEnabled      bool   `json:"otp_enabled"`
}

// AppSettingResponse is a single public app configuration entry.
type AppSettingResponse struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
}

// AdminAppSettingResponse includes isPublic (admin only).
type AdminAppSettingResponse struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
	IsPublic    bool   `json:"is_public"`
}

// AdminUpsertAppSettingRequest is the input for admin upsert.
type AdminUpsertAppSettingRequest struct {
	Key         string `json:"key" validate:"required"`
	Value       string `json:"value" validate:"required"`
	Description string `json:"description"`
	IsPublic    *bool  `json:"is_public,omitempty"`
}
