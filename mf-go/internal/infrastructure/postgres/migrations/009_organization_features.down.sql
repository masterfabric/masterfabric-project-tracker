DROP TABLE IF EXISTS organization_messages;
DROP TABLE IF EXISTS organization_news;

ALTER TABLE organization_members DROP COLUMN IF EXISTS membership_status;

ALTER TABLE organizations DROP COLUMN IF EXISTS contact_email;
ALTER TABLE organizations DROP COLUMN IF EXISTS website_url;
ALTER TABLE organizations DROP COLUMN IF EXISTS logo_url;
ALTER TABLE organizations DROP COLUMN IF EXISTS description;
