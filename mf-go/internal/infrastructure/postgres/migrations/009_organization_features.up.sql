-- Organization profile, member lifecycle, internal news, and org-wide chat.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website_url TEXT NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '';

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active'
    CHECK (membership_status IN ('active', 'suspended'));

CREATE TABLE IF NOT EXISTS organization_news (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    author_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            TEXT        NOT NULL,
    description      TEXT        NOT NULL DEFAULT '',
    image_url        TEXT        NOT NULL DEFAULT '',
    rich_metadata    JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_news_org_created
    ON organization_news (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS organization_messages (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    author_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body             TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_messages_org_created
    ON organization_messages (organization_id, created_at DESC);
