DROP INDEX IF EXISTS idx_organization_project_todos_due_at;
ALTER TABLE organization_project_todos DROP COLUMN IF EXISTS due_at;
