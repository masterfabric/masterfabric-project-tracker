-- Organization-scoped projects: membership per project and todos per project (GFG-92).

CREATE TABLE IF NOT EXISTS organization_projects (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                 TEXT        NOT NULL,
    description          TEXT        NOT NULL DEFAULT '',
    created_by_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_projects_organization_id
    ON organization_projects(organization_id);

CREATE TABLE IF NOT EXISTS organization_project_members (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID        NOT NULL REFERENCES organization_projects(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_project_members_project_id
    ON organization_project_members(project_id);

CREATE TABLE IF NOT EXISTS organization_project_todos (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID        NOT NULL REFERENCES organization_projects(id) ON DELETE CASCADE,
    title                TEXT        NOT NULL,
    status               TEXT        NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open', 'done')),
    created_by_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_project_todos_project_id
    ON organization_project_todos(project_id);
