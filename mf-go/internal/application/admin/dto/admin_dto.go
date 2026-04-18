package dto

import "time"

// AdminUserResponse is a full user view returned to admin callers.
type AdminUserResponse struct {
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

// AdminUserListResponse wraps paginated user results.
type AdminUserListResponse struct {
	Users      []*AdminUserResponse `json:"users"`
	TotalCount int                  `json:"total_count"`
	Page       int                  `json:"page"`
	PageSize   int                  `json:"page_size"`
}

// ChangeRoleRequest is the input for an admin role change operation.
type ChangeRoleRequest struct {
	TargetUserID string `json:"target_user_id" validate:"required,uuid4"`
	Role         string `json:"role"           validate:"required,oneof=admin moderator user"`
}

// SuspendUserRequest is the input for suspending or reactivating a user.
type SuspendUserRequest struct {
	TargetUserID string `json:"target_user_id" validate:"required,uuid4"`
	Suspend      bool   `json:"suspend"` // true = suspend, false = reactivate
}

// SetUserStatusRequest is the input for setting a user's status (active, inactive, suspended).
// GraphQL sends ACTIVE/INACTIVE/SUSPENDED; use case normalizes to lowercase.
type SetUserStatusRequest struct {
	TargetUserID string `json:"target_user_id" validate:"required,uuid4"`
	Status       string `json:"status"        validate:"required,oneof=active inactive suspended ACTIVE INACTIVE SUSPENDED"`
}
