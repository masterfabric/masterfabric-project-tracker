-- Organization project purchase line items (GFG-113).

CREATE TABLE IF NOT EXISTS organization_project_purchases (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID        NOT NULL REFERENCES organization_projects(id) ON DELETE CASCADE,
    product_name         TEXT        NOT NULL,
    tax_rate             DOUBLE PRECISION NOT NULL DEFAULT 0,
    product_purpose      TEXT        NOT NULL DEFAULT '',
    price                DOUBLE PRECISION NOT NULL,
    quantity             DOUBLE PRECISION NOT NULL DEFAULT 1,
    product_link         TEXT,
    status               TEXT        NOT NULL DEFAULT 'requested'
                         CHECK (status IN ('requested', 'purchased', 'cancelled')),
    status_note          TEXT        NOT NULL DEFAULT '',
    currency             TEXT        NOT NULL DEFAULT 'TRY',
    created_by_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_project_purchases_project_id
    ON organization_project_purchases(project_id);
