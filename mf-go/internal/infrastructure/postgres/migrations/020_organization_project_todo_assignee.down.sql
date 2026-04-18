DROP INDEX IF EXISTS idx_organization_project_todos_assigned_to_user_id;

ALTER TABLE organization_project_todos
    DROP COLUMN IF EXISTS assigned_to_user_id;
