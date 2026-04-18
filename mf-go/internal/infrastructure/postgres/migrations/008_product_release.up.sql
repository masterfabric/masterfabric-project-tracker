-- Published product version + changelog (Markdown), editable by admins via GraphQL.
-- Single logical row (id = 1).

CREATE TABLE IF NOT EXISTS product_release (
    id                    SMALLINT PRIMARY KEY CHECK (id = 1),
    version               TEXT        NOT NULL DEFAULT '0.1.0',
    changelog_markdown    TEXT        NOT NULL DEFAULT '',
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_user_id    UUID        REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO product_release (id, version, changelog_markdown)
VALUES (1, '0.1.0', '')
ON CONFLICT (id) DO NOTHING;
