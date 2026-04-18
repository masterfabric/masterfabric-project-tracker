-- Optional assignee on organization project todos (admin/owner can delegate from app).

ALTER TABLE organization_project_todos
    ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organization_project_todos_assigned_to_user_id
    ON organization_project_todos(assigned_to_user_id);
