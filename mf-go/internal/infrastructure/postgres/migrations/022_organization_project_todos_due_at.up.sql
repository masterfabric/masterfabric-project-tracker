ALTER TABLE organization_project_todos
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_organization_project_todos_due_at ON organization_project_todos(due_at)
    WHERE due_at IS NOT NULL;
