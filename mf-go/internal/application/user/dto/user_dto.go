package dto

import "time"

// UpdateProfileRequest contains fields the user can update.
// All extended fields are optional pointers — omit to leave unchanged.
type UpdateProfileRequest struct {
	UserID           string  `validate:"required,uuid4"`
	Email            *string `validate:"omitempty,email,max=255"`
	EmailChangeOtpID *string `validate:"omitempty,uuid4"`
	DisplayName      *string `validate:"omitempty,min=2,max=100"`
	Nickname       *string    `validate:"omitempty,max=80"`
	AvatarURL      *string    `validate:"omitempty,url"`
	Bio            *string    `validate:"omitempty,max=500"`
	PhoneNumber    *string    `validate:"omitempty,max=32"`
	TelegramChatID *string    `validate:"omitempty,max=32"`
	DateOfBirth    *time.Time `validate:"omitempty"`
	Gender         *string    `validate:"omitempty,oneof=male female other prefer_not_to_say"`
	Location       *string    `validate:"omitempty,max=200"`
	WebsiteURL     *string    `validate:"omitempty,url"`
	SocialTwitter  *string    `validate:"omitempty,max=200"`
	SocialGitHub   *string    `validate:"omitempty,max=200"`
	SocialLinkedIn *string    `validate:"omitempty,max=200"`
	Language       *string    `validate:"omitempty,min=2,max=10"`
}

// UserProfileResponse is the safe user data returned to clients.
type UserProfileResponse struct {
	ID             string     `json:"id"`
	Email          string     `json:"email"`
	DisplayName    string     `json:"display_name"`
	Nickname       string     `json:"nickname"`
	AvatarURL      string     `json:"avatar_url"`
	Bio            string     `json:"bio"`
	Status         string     `json:"status"`
	Role           string     `json:"role"`
	CreatedAt      string     `json:"created_at"`
	UpdatedAt      string     `json:"updated_at"`
	PhoneNumber    string     `json:"phone_number"`
	DateOfBirth    *time.Time `json:"date_of_birth,omitempty"`
	Gender         string     `json:"gender"`
	Location       string     `json:"location"`
	WebsiteURL     string     `json:"website_url"`
	SocialTwitter  string     `json:"social_twitter"`
	SocialGitHub   string     `json:"social_github"`
	SocialLinkedIn string     `json:"social_linkedin"`
	Language       string     `json:"language"`
	TelegramChatID string     `json:"telegram_chat_id"`
}

// ── Address DTOs ──────────────────────────────────────────────────────────────

// UpsertAddressRequest is used by both createAddress and updateAddress mutations.
// All fields except UserID are optional — omit to leave unchanged on update.
type UpsertAddressRequest struct {
	UserID       string  `validate:"required,uuid4"`
	AddressID    *string `validate:"omitempty,uuid4"` // nil → create new, non-nil → update existing
	Title        *string `validate:"omitempty,max=100"`
	AddressLine1 *string `validate:"omitempty,max=255"`
	AddressLine2 *string `validate:"omitempty,max=255"`
	City         *string `validate:"omitempty,max=100"`
	State        *string `validate:"omitempty,max=100"`
	PostalCode   *string `validate:"omitempty,max=20"`
	Country      *string `validate:"omitempty,max=100"`
	IsDefault    *bool
}

// AddressResponse is returned after any address read or write operation.
type AddressResponse struct {
	ID           string `json:"id"`
	UserID       string `json:"user_id"`
	Title        string `json:"title"`
	AddressLine1 string `json:"address_line1"`
	AddressLine2 string `json:"address_line2"`
	City         string `json:"city"`
	State        string `json:"state"`
	PostalCode   string `json:"postal_code"`
	Country      string `json:"country"`
	IsDefault    bool   `json:"is_default"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}
