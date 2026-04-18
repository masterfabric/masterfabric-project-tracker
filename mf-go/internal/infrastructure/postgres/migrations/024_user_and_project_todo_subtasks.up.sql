-- GFG-117: single-level checklist subtasks under user todos and organization project todos.

CREATE TABLE IF NOT EXISTS user_todo_subtasks (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_todo_id UUID        NOT NULL REFERENCES user_todos(id) ON DELETE CASCADE,
    title        TEXT        NOT NULL,
    completed    BOOLEAN     NOT NULL DEFAULT FALSE,
    sort_order   INT         NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_todo_subtasks_user_todo_id ON user_todo_subtasks(user_todo_id);

CREATE TABLE IF NOT EXISTS organization_project_todo_subtasks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_todo_id UUID        NOT NULL REFERENCES organization_project_todos(id) ON DELETE CASCADE,
    title           TEXT        NOT NULL,
    completed       BOOLEAN     NOT NULL DEFAULT FALSE,
    sort_order      INT         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_project_todo_subtasks_parent ON organization_project_todo_subtasks(project_todo_id);
