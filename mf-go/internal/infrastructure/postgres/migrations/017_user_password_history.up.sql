-- Stores previously used password hashes per user (up to 3) to block reuse.

CREATE TABLE IF NOT EXISTS user_password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_password_history_user_created
  ON user_password_history (user_id, created_at DESC);
