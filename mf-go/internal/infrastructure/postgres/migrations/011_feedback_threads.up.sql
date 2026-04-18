-- 011_feedback_threads.up.sql — User feedback threads with admin reply timeline (GFG-24).

CREATE TABLE IF NOT EXISTS feedback_threads (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject    TEXT        NOT NULL DEFAULT '',
    status     TEXT        NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id   UUID        NOT NULL REFERENCES feedback_threads(id) ON DELETE CASCADE,
    author_role TEXT        NOT NULL CHECK (author_role IN ('USER', 'ADMIN')),
    body        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_threads_user_id ON feedback_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_updated_at ON feedback_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_thread_id ON feedback_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_created_at ON feedback_messages(thread_id, created_at ASC);
