-- 004: Admin deactivation / suspend triggers session + token revocation in application code
-- (Redis: mf:user:access_revoked_at:<userId>, refresh token SCAN delete; Postgres: DELETE user_sessions).
-- No DDL; version bump keeps migration sequence aligned with releases.

SELECT 1;
