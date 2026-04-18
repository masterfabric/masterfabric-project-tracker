package dto

// RegisterRequest is the input for user registration.
type RegisterRequest struct {
	Email       string `validate:"required,email"`
	Password    string `validate:"required,min=8"`
	DisplayName string `validate:"required,min=2,max=100"`
}

// LoginRequest is the input for user login.
type LoginRequest struct {
	Email    string `validate:"required,email"`
	Password string `validate:"required"`
	// ClientIP optional; set from HTTP layer for rate limiting (chi RealIP).
	ClientIP string
}

// RefreshRequest contains the refresh token to rotate.
type RefreshRequest struct {
	UserID       string `validate:"required,uuid4"`
	RefreshToken string `validate:"required"`
	DeviceID     string // Optional: for session tracking (admin can see active sessions)
	Platform     string
	DeviceName   string
}

// LogoutRequest contains tokens to revoke.
type LogoutRequest struct {
	UserID       string `validate:"required,uuid4"`
	AccessToken  string `validate:"required"`
	RefreshToken string `validate:"required"`
}

// LoginResponse is returned by login. When OTPRequired is true,
// the client must call loginVerifyOTP with LoginToken + OTP code.
type LoginResponse struct {
	OTPRequired  bool     `json:"otp_required"`
	LoginToken   string   `json:"login_token,omitempty"`
	AccessToken  string   `json:"access_token,omitempty"`
	RefreshToken string   `json:"refresh_token,omitempty"`
	ExpiresIn    int64    `json:"expires_in,omitempty"`
	User         UserData `json:"user"`
}

// ResetPasswordWithOtpRequest completes password reset after email OTP.
type ResetPasswordWithOtpRequest struct {
	Email       string `validate:"required,email"`
	Code        string `validate:"required,len=6"`
	NewPassword string `validate:"required,min=8"`
}

// LoginVerifyOTPRequest is the input for completing OTP-based login.
type LoginVerifyOTPRequest struct {
	LoginToken string `validate:"required"`
	Code       string `validate:"required,len=6"`
}

// AuthResponse is returned after a successful login or register.
type AuthResponse struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	ExpiresIn    int64    `json:"expires_in"`
	User         UserData `json:"user"`
}

// UserData is a safe subset of user fields for client responses.
type UserData struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	Role        string `json:"role"`
}
