-- Optional scheduled moment (date + time) for user todos (UTC stored as timestamptz).
ALTER TABLE user_todos
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_user_todos_due_at ON user_todos(due_at)
    WHERE due_at IS NOT NULL;
