-- 006: Add otp_enabled flag to user_settings (default false).
-- When true, the user must verify an OTP code after password authentication.

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN NOT NULL DEFAULT false;
