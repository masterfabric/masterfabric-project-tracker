-- 002_user_sessions.up.sql
-- Tracks active user sessions (refreshed periodically). Admin can view.

CREATE TABLE IF NOT EXISTS user_sessions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id        TEXT        NOT NULL DEFAULT '',
    platform         TEXT        NOT NULL DEFAULT '',
    device_name      TEXT        NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_refreshed ON user_sessions(last_refreshed_at DESC);
