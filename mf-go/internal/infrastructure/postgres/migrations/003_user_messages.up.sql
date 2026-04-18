-- 003_user_messages.up.sql
-- User-specific messages from admin. Shown as snackbar on home. Real-time via GraphQL subscription.

CREATE TABLE IF NOT EXISTS user_messages (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message    TEXT        NOT NULL,
    type       TEXT        NOT NULL DEFAULT 'info'
                         CHECK (type IN ('info', 'warning', 'success', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_messages_user_id ON user_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_created_at ON user_messages(created_at DESC);
