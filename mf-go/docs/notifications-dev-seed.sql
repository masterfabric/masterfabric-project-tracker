-- Dev / staging: sample rows for `notifications` (broadcast list).
-- Run against your Postgres after migrations, e.g.:
--   psql "$DATABASE_URL" -f docs/notifications-dev-seed.sql
--
-- Fixed UUIDs so you can delete or re-run cleanup easily:
--   DELETE FROM notifications WHERE id IN (
--     'a0000001-0000-4000-8000-000000000001',
--     'a0000001-0000-4000-8000-000000000002',
--     'a0000001-0000-4000-8000-000000000003'
--   );

INSERT INTO notifications (
  id,
  title,
  subtitle,
  message,
  type,
  category,
  icon,
  language,
  action_url,
  image_url,
  priority,
  created_at,
  updated_at
) VALUES
  (
    'a0000001-0000-4000-8000-000000000001',
    'Welcome (all locales)',
    'Seed',
    'language is empty → visible in every app locale.',
    'info',
    'app',
    NULL,
    '',
    NULL,
    NULL,
    'normal',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'a0000001-0000-4000-8000-000000000002',
    'English-only broadcast',
    'en',
    'Shown when app language matches en (or admin list shows everything).',
    'success',
    'app',
    NULL,
    'en',
    NULL,
    NULL,
    'normal',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    'a0000001-0000-4000-8000-000000000003',
    'System maintenance',
    'Scheduled',
    'category system + type warning — appears under System tab for users.',
    'warning',
    'system',
    NULL,
    '',
    NULL,
    NULL,
    'high',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '3 hours'
  )
ON CONFLICT (id) DO NOTHING;
