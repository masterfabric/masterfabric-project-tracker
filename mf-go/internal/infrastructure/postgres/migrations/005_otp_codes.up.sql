-- 005_otp_codes.up.sql
-- OTP codes table: audit log for all OTP requests, also used for admin views.
-- Active (short-lived) codes are cached in Redis; this table keeps the full history.

CREATE TABLE IF NOT EXISTS otp_codes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code        TEXT        NOT NULL,
    channel     TEXT        NOT NULL DEFAULT 'admin_panel'
                              CHECK (channel IN ('admin_panel', 'email', 'sms', 'whatsapp', 'telegram')),
    purpose     TEXT        NOT NULL DEFAULT 'login'
                              CHECK (purpose IN ('login', 'verify_identity', 'password_reset', 'account_activate')),
    status      TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'verified', 'expired')),
    attempts    INTEGER     NOT NULL DEFAULT 0,
    max_retries INTEGER     NOT NULL DEFAULT 5,
    expires_at  TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id    ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_status      ON otp_codes(status);
CREATE INDEX IF NOT EXISTS idx_otp_codes_created_at  ON otp_codes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at  ON otp_codes(expires_at);
