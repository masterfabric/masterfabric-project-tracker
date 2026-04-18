package otp

// App setting keys for OTP email (admin-managed, is_public=false).
//
// #nosec G101 — setting key names, not secrets.
const (
	AppSettingOTPEmailEnabled              = "otp_email_enabled"
	AppSettingOTPEmailSubjectLogin         = "otp_email_subject_login"
	AppSettingOTPEmailBodyLogin            = "otp_email_body_login"
	AppSettingOTPEmailSubjectPasswordReset = "otp_email_subject_password_reset"
	AppSettingOTPEmailBodyPasswordReset    = "otp_email_body_password_reset"
)
