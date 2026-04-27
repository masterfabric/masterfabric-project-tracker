-- GFG-172 / GFG-179: one canonical organization_projects row; extra orgs join via participation (invite lifecycle + capabilities stub).

CREATE TABLE IF NOT EXISTS organization_project_org_participations (
    id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id                    UUID        NOT NULL REFERENCES organization_projects(id) ON DELETE CASCADE,
    participant_organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status                        TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
    capabilities                  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    invited_by_user_id            UUID        NULL REFERENCES users(id) ON DELETE SET NULL,
    invited_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at                  TIMESTAMPTZ NULL,
    leave_clear_partner_attribution_display BOOLEAN NULL,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, participant_organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_project_org_participations_project_id
    ON organization_project_org_participations(project_id);

CREATE INDEX IF NOT EXISTS idx_org_project_org_participations_participant_org
    ON organization_project_org_participations(participant_organization_id);

CREATE INDEX IF NOT EXISTS idx_org_project_org_participations_status
    ON organization_project_org_participations(status);

-- Append-only audit for cross-org security events (invites, capability changes, leave, ownership transfer, etc.).
CREATE TABLE IF NOT EXISTS organization_project_org_audit_events (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID        NOT NULL REFERENCES organization_projects(id) ON DELETE CASCADE,
    actor_user_id  UUID        NULL REFERENCES users(id) ON DELETE SET NULL,
    event_type     TEXT        NOT NULL,
    metadata       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_org_audit_project_id
    ON organization_project_org_audit_events(project_id);

CREATE INDEX IF NOT EXISTS idx_project_org_audit_created_at
    ON organization_project_org_audit_events(created_at);
