-- 001_init_schema.up.sql
-- MasterFabric: Full schema (open-source consolidated migration)
-- Uses gen_random_uuid() (built-in since PG13) for Azure compatibility (uuid-ossp not allow-listed).

-- ── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    display_name  TEXT        NOT NULL DEFAULT '',
    avatar_url    TEXT        NOT NULL DEFAULT '',
    bio           TEXT        NOT NULL DEFAULT '',
    status        TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'inactive', 'suspended')),
    role          TEXT        NOT NULL DEFAULT 'user'
                                CHECK (role IN ('admin', 'moderator', 'user')),
    phone_number  TEXT        NOT NULL DEFAULT '',
    date_of_birth DATE,
    gender        TEXT        NOT NULL DEFAULT ''
                                CHECK (gender IN ('', 'male', 'female', 'other', 'prefer_not_to_say')),
    location      TEXT        NOT NULL DEFAULT '',
    website_url   TEXT        NOT NULL DEFAULT '',
    social_twitter TEXT       NOT NULL DEFAULT '',
    social_github TEXT        NOT NULL DEFAULT '',
    social_linkedin TEXT      NOT NULL DEFAULT '',
    language      TEXT        NOT NULL DEFAULT 'en',
    nickname      TEXT        NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ── user_settings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    notifications_on BOOLEAN     NOT NULL DEFAULT true,
    theme            TEXT        NOT NULL DEFAULT 'system'
                                   CHECK (theme IN ('light', 'dark', 'system')),
    language         TEXT        NOT NULL DEFAULT 'en',
    timezone         TEXT        NOT NULL DEFAULT 'UTC',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings (user_id);

-- ── app_settings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    key         TEXT        NOT NULL UNIQUE,
    value       TEXT        NOT NULL DEFAULT '',
    description TEXT        NOT NULL DEFAULT '',
    is_public   BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key       ON app_settings (key);
CREATE INDEX IF NOT EXISTS idx_app_settings_is_public ON app_settings (is_public);

INSERT INTO app_settings (key, value, description, is_public) VALUES
    ('app.version',          '1.0.0',  'Current application version',          true),
    ('app.maintenance',      'false',  'Maintenance mode flag',                 true),
    ('app.min_app_version',  '1.0.0',  'Minimum supported mobile app version', true),
    ('projects.masterfabric',       'true',  'Show MasterFabric projects tab',  true),
    ('projects.masterfabric_mobile','true',  'Show MasterFabric Mobile projects tab', true)
ON CONFLICT (key) DO NOTHING;

-- ── user_addresses ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_addresses (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT        NOT NULL DEFAULT '',
    address_line1 TEXT       NOT NULL DEFAULT '',
    address_line2 TEXT       NOT NULL DEFAULT '',
    city         TEXT        NOT NULL DEFAULT '',
    state        TEXT        NOT NULL DEFAULT '',
    postal_code  TEXT        NOT NULL DEFAULT '',
    country      TEXT        NOT NULL DEFAULT '',
    is_default   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_addresses_default
    ON user_addresses(user_id) WHERE is_default = TRUE;

-- ── user_devices ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_devices (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id    TEXT        NOT NULL,
    platform     TEXT        NOT NULL DEFAULT '',
    device_name  TEXT        NOT NULL DEFAULT '',
    model        TEXT        NOT NULL DEFAULT '',
    brand        TEXT        NOT NULL DEFAULT '',
    os_name      TEXT        NOT NULL DEFAULT '',
    os_version   TEXT        NOT NULL DEFAULT '',
    app_name     TEXT        NOT NULL DEFAULT '',
    app_version  TEXT        NOT NULL DEFAULT '',
    app_build    TEXT        NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);

-- ── organizations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    owner_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner_user_id ON organizations(owner_user_id);

CREATE TABLE IF NOT EXISTS organization_members (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            TEXT        NOT NULL DEFAULT 'member'
                                CHECK (role IN ('owner', 'admin', 'member')),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);

CREATE TABLE IF NOT EXISTS organization_invitations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    inviter_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_email   TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, invitee_email)
);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_organization_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_invitee_email ON organization_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_status ON organization_invitations(status);

-- ── user_todos ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_todos (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id     UUID        REFERENCES organizations(id) ON DELETE SET NULL,
    assigned_to_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
    title               TEXT        NOT NULL,
    completed           BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_todos_user_id ON user_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_todos_created_at ON user_todos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_todos_organization_id ON user_todos(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_todos_assigned_to_user_id ON user_todos(assigned_to_user_id);

-- ── notifications ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT        NOT NULL,
    message     TEXT        NOT NULL,
    type        TEXT        NOT NULL DEFAULT 'info'
                            CHECK (type IN ('info', 'warning', 'success', 'error')),
    category    TEXT        NOT NULL DEFAULT 'app',
    icon        TEXT,
    language    TEXT        DEFAULT '',
    subtitle    TEXT        DEFAULT '',
    action_url  TEXT,
    image_url   TEXT,
    priority    TEXT        DEFAULT 'normal'
                            CHECK (priority IN ('high', 'normal', 'low')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_language ON notifications(language);

CREATE TABLE IF NOT EXISTS notification_reads (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id UUID        NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id ON notification_reads(notification_id);
