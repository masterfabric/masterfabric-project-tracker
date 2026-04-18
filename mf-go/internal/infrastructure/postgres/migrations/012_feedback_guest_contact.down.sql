-- 012_feedback_guest_contact.down.sql

DELETE FROM feedback_messages WHERE thread_id IN (SELECT id FROM feedback_threads WHERE user_id IS NULL);
DELETE FROM feedback_threads WHERE user_id IS NULL;

ALTER TABLE feedback_threads DROP COLUMN IF EXISTS guest_contact_email;
ALTER TABLE feedback_threads ALTER COLUMN user_id SET NOT NULL;
