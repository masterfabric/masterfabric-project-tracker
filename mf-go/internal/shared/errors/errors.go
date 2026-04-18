package errors

import (
	stderrors "errors"
	"fmt"
)

// DomainError is a typed application error that carries a machine-readable code,
// a human-readable message, and an optional cause.
type DomainError struct {
	Code    string
	Message string
	Cause   error
}

func (e *DomainError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *DomainError) Unwrap() error { return e.Cause }

// New creates a new DomainError.
func New(code, message string, cause error) *DomainError {
	return &DomainError{Code: code, Message: message, Cause: cause}
}

// Sentinel domain errors
var (
	ErrUserNotFound            = New("USER_NOT_FOUND", "user not found", nil)
	ErrEmailTaken              = New("EMAIL_TAKEN", "email already registered", nil)
	ErrInvalidCredentials      = New("INVALID_CREDENTIALS", "invalid email or password", nil)
	ErrLoginRateLimited        = New("LOGIN_RATE_LIMITED", "too many login attempts, try again later", nil)
	ErrPasswordReuseNotAllowed = New("PASSWORD_REUSE_NOT_ALLOWED", "choose a password you have not used recently", nil)
	ErrAccountDisabled         = New("ACCOUNT_DISABLED", "account is inactive or suspended", nil)
	ErrTokenExpired            = New("TOKEN_EXPIRED", "token has expired", nil)
	ErrTokenInvalid            = New("TOKEN_INVALID", "token is invalid", nil)
	// ErrSessionStoreUnavailable is returned when Redis/cache cannot store refresh tokens
	// (e.g. dev without Redis). Login must not return a refresh token that can never be rotated.
	ErrSessionStoreUnavailable = New("SESSION_STORE_UNAVAILABLE", "session store unavailable; start Redis or set REDIS_REQUIRED per environment docs", nil)
	ErrUnauthorized            = New("UNAUTHORIZED", "authentication required", nil)
	ErrForbidden               = New("FORBIDDEN", "access denied", nil)
	ErrSettingsNotFound        = New("SETTINGS_NOT_FOUND", "settings not found", nil)
	ErrNotificationNotFound    = New("NOTIFICATION_NOT_FOUND", "notification not found", nil)
	ErrAddressNotFound         = New("ADDRESS_NOT_FOUND", "address not found", nil)
	ErrTodoNotFound            = New("TODO_NOT_FOUND", "todo not found", nil)
	ErrInternal                = New("INTERNAL_ERROR", "an internal error occurred", nil)
	// OTP email delivery
	ErrOTPUserEmailMissing = New("OTP_NO_EMAIL", "your account has no email address on file", nil)
	// OTP WhatsApp / Telegram
	ErrOTPNoPhoneForWhatsApp = New("OTP_NO_PHONE", "add a phone number in E.164 format to your profile for WhatsApp OTP", nil)
	ErrOTPNoTelegramChat     = New("OTP_NO_TELEGRAM", "link your Telegram chat ID in your profile (updateProfile.telegramChatId)", nil)
	// Product release (admin-published changelog)
	ErrProductReleaseVersionRequired = New("PRODUCT_RELEASE_VERSION_REQUIRED", "version is required", nil)
	// Feedback (GFG-24)
	ErrFeedbackThreadNotFound     = New("FEEDBACK_THREAD_NOT_FOUND", "feedback thread not found", nil)
	ErrFeedbackMessageEmpty       = New("FEEDBACK_MESSAGE_EMPTY", "message cannot be empty", nil)
	ErrFeedbackGuestEmailRequired = New("FEEDBACK_GUEST_EMAIL_REQUIRED", "contact email is required when not signed in", nil)
	ErrFeedbackGuestEmailInvalid  = New("FEEDBACK_GUEST_EMAIL_INVALID", "contact email must look like a valid email address", nil)
	// OTP email disabled by admin (app_settings otp_email_enabled=false)
	ErrOTPEmailDisabled = New("OTP_EMAIL_DISABLED", "OTP email delivery is disabled by the administrator", nil)
)

// IsCode reports whether err is or wraps a DomainError with the given code.
func IsCode(err error, code string) bool {
	var de *DomainError
	for err != nil {
		if stderrors.As(err, &de) && de.Code == code {
			return true
		}
		err = stderrors.Unwrap(err)
	}
	return false
}

// Is implements errors.Is compatibility for sentinel errors (by code).
func Is(err error, target *DomainError) bool {
	if de, ok := err.(*DomainError); ok {
		return de.Code == target.Code
	}
	return false
}
