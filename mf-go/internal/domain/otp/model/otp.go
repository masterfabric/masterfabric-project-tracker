package model

import (
	"time"

	"github.com/google/uuid"
)

// OTPChannel is the delivery channel used to send the OTP code.
type OTPChannel string

const (
	OTPChannelAdminPanel OTPChannel = "admin_panel"
	OTPChannelEmail      OTPChannel = "email"
	OTPChannelSMS        OTPChannel = "sms"
	OTPChannelWhatsApp   OTPChannel = "whatsapp"
	OTPChannelTelegram   OTPChannel = "telegram"
)

// OTPPurpose describes why the OTP was generated.
type OTPPurpose string

const (
	OTPPurposeLogin           OTPPurpose = "login"
	OTPPurposeVerifyIdentity  OTPPurpose = "verify_identity"
	OTPPurposePasswordReset   OTPPurpose = "password_reset"
	OTPPurposeAccountActivate OTPPurpose = "account_activate"
	OTPPurposeEmailChange     OTPPurpose = "email_change"
)

// OTPStatus tracks the lifecycle of an OTP code.
type OTPStatus string

const (
	OTPStatusPending  OTPStatus = "pending"
	OTPStatusVerified OTPStatus = "verified"
	OTPStatusExpired  OTPStatus = "expired"
)

// OTPCode represents a one-time password sent to a user.
type OTPCode struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Code       string
	Channel    OTPChannel
	Purpose    OTPPurpose
	Status     OTPStatus
	Attempts   int
	MaxRetries int
	ExpiresAt  time.Time
	VerifiedAt *time.Time
	CreatedAt  time.Time
}

// IsExpired reports whether the code has passed its expiration time.
func (o *OTPCode) IsExpired() bool {
	return time.Now().UTC().After(o.ExpiresAt)
}

// IsMaxAttemptsReached reports whether the maximum verification attempts have been exhausted.
func (o *OTPCode) IsMaxAttemptsReached() bool {
	return o.Attempts >= o.MaxRetries
}
