-- Admin-only app_settings for OTP email kill-switch and plain-text templates (see docs/OTP_CONFIGURATION.md).
INSERT INTO app_settings (key, value, description, is_public) VALUES
(
    'otp_email_enabled',
    '',
    'When set to false, outbound OTP email is disabled (both mode falls back to admin_panel). Empty = enabled.',
    false
),
(
    'otp_email_subject_login',
    '',
    'Go text/template for login/identity OTP email subject. Placeholders: .AppName .Code .PurposeHuman .ExpiryMinutes. Empty = default.',
    false
),
(
    'otp_email_body_login',
    '',
    'Go text/template for login/identity OTP email body (plain text). Same placeholders as subject.',
    false
),
(
    'otp_email_subject_password_reset',
    '',
    'Go text/template for password-reset OTP email subject. Same placeholders.',
    false
),
(
    'otp_email_body_password_reset',
    '',
    'Go text/template for password-reset OTP email body. Same placeholders.',
    false
)
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    is_public = false,
    updated_at = NOW();
