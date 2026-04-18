-- Single-row SMTP settings managed by admins (secrets not exposed via app_settings API).
CREATE TABLE IF NOT EXISTS system_mail_smtp (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT false,
    host TEXT NOT NULL DEFAULT '',
    port INT NOT NULL DEFAULT 587,
    username TEXT NOT NULL DEFAULT '',
    password TEXT NOT NULL DEFAULT '',
    from_address TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '',
    subject_prefix TEXT NOT NULL DEFAULT 'MasterFabric',
    implicit_tls BOOLEAN NOT NULL DEFAULT false,
    plain_no_tls BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO system_mail_smtp (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
