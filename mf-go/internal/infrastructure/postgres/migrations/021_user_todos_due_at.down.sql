DROP INDEX IF EXISTS idx_user_todos_due_at;
ALTER TABLE user_todos DROP COLUMN IF EXISTS due_at;
