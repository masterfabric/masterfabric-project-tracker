DELETE FROM app_settings WHERE key IN (
    'otp_email_enabled',
    'otp_email_subject_login',
    'otp_email_body_login',
    'otp_email_subject_password_reset',
    'otp_email_body_password_reset'
);
