package dto

import "time"

// RequestOTPRequest is the input for requesting a new OTP code.
type RequestOTPRequest struct {
	UserID  string `validate:"required,uuid4"`
	Purpose string `validate:"required,oneof=login verify_identity password_reset account_activate email_change"`
}

// RequestOTPResponse is returned after an OTP is generated.
type RequestOTPResponse struct {
	OTPID     string    `json:"otp_id"`
	Channel   string    `json:"channel"`
	ExpiresAt time.Time `json:"expires_at"`
}

// VerifyOTPRequest is the input for verifying an OTP code.
type VerifyOTPRequest struct {
	UserID  string `validate:"required,uuid4"`
	Code    string `validate:"required,len=6"`
	Purpose string `validate:"required,oneof=login verify_identity password_reset account_activate email_change"`
}

// VerifyOTPResponse is returned after a successful OTP verification.
type VerifyOTPResponse struct {
	Verified bool   `json:"verified"`
	OTPID    string `json:"otp_id"`
}

// AdminOTPResponse is a single OTP entry for admin views.
type AdminOTPResponse struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	Code       string     `json:"code"`
	Channel    string     `json:"channel"`
	Purpose    string     `json:"purpose"`
	Status     string     `json:"status"`
	Attempts   int        `json:"attempts"`
	MaxRetries int        `json:"max_retries"`
	ExpiresAt  time.Time  `json:"expires_at"`
	VerifiedAt *time.Time `json:"verified_at"`
	CreatedAt  time.Time  `json:"created_at"`
}
