-- GFG-187: archive support for user/project todos and organization projects.
-- Subtask archive behavior is parent-based: archived parent todo hides child subtasks.

ALTER TABLE user_todos
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

ALTER TABLE organization_project_todos
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

ALTER TABLE organization_projects
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_user_todos_archived_at ON user_todos(archived_at);
CREATE INDEX IF NOT EXISTS idx_org_project_todos_archived_at ON organization_project_todos(archived_at);
CREATE INDEX IF NOT EXISTS idx_org_projects_archived_at ON organization_projects(archived_at);
