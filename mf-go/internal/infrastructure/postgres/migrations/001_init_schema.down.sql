-- 001_init_schema.down.sql
-- Drops all tables in reverse dependency order.

DROP TABLE IF EXISTS notification_reads;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS organization_invitations;
DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS user_todos;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS user_devices;
DROP TABLE IF EXISTS user_addresses;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS users;
