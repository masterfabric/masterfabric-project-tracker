DROP INDEX IF EXISTS idx_org_projects_archived_at;
DROP INDEX IF EXISTS idx_org_project_todos_archived_at;
DROP INDEX IF EXISTS idx_user_todos_archived_at;

ALTER TABLE organization_projects
    DROP COLUMN IF EXISTS archived_at;

ALTER TABLE organization_project_todos
    DROP COLUMN IF EXISTS archived_at;

ALTER TABLE user_todos
    DROP COLUMN IF EXISTS archived_at;
