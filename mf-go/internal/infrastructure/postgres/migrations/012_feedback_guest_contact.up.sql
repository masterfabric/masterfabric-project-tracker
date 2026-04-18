-- 012_feedback_guest_contact.up.sql — Guest feedback: optional user_id + contact email for non-auth submitters.

ALTER TABLE feedback_threads
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE feedback_threads
    ADD COLUMN IF NOT EXISTS guest_contact_email TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN feedback_threads.guest_contact_email IS 'Email for guest submissions; empty when user_id is set.';
