package redis

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

// Key-builder helpers centralise every Redis key pattern in one place.
// All keys are prefixed with "mf:" to namespace MasterFabric keys on a
// shared Redis instance.

// RefreshTokenKey returns the Redis key used to store a refresh token.
// Pattern: mf:refresh:<userID>:<token>
func RefreshTokenKey(userID, token string) string {
	return fmt.Sprintf("mf:refresh:%s:%s", userID, token)
}

// TokenBlacklistKey returns the Redis key used to blacklist an access token.
// Pattern: mf:blacklist:<token>
func TokenBlacklistKey(token string) string {
	return fmt.Sprintf("mf:blacklist:%s", token)
}

// UserAccessRevokedAtKey stores Unix seconds when admin forced logout (inactive/suspend).
// Access tokens with iat <= this value are rejected until the key TTL expires.
// Pattern: mf:user:access_revoked_at:<userID>
func UserAccessRevokedAtKey(userID string) string {
	return fmt.Sprintf("mf:user:access_revoked_at:%s", userID)
}

// RefreshTokenPatternForUser returns a Redis SCAN pattern for all refresh tokens of a user.
func RefreshTokenPatternForUser(userID string) string {
	return fmt.Sprintf("mf:refresh:%s:*", userID)
}

// UserSettingsCacheKey returns the Redis key used to cache user settings.
// Pattern: mf:settings:user:<userID>
func UserSettingsCacheKey(userID string) string {
	return fmt.Sprintf("mf:settings:user:%s", userID)
}

// AppSettingsCacheKey returns the Redis key used to cache an app-settings
// entry by its string key.
// Pattern: mf:settings:app:<key>
func AppSettingsCacheKey(key string) string {
	return fmt.Sprintf("mf:settings:app:%s", key)
}

// PublicAppSettingsSnapshotKey is the Redis key for the JSON snapshot of all
// public app_settings rows (see GetAppSettingsUseCase). keyPrefix is
// cfg.Cache.KeyPrefix (often empty).
func PublicAppSettingsSnapshotKey(keyPrefix string) string {
	return keyPrefix + "mf:app_settings:public"
}

// ProductReleaseCurrentKey is the Redis key for the cached product_release row JSON.
func ProductReleaseCurrentKey(keyPrefix string) string {
	return keyPrefix + "mf:product_release:current"
}

// PrefixedUserSettingsCacheKey returns keyPrefix + UserSettingsCacheKey(userID).
func PrefixedUserSettingsCacheKey(keyPrefix, userID string) string {
	return keyPrefix + UserSettingsCacheKey(userID)
}

// OTPCodeKey returns the Redis key for an active OTP code.
// Pattern: mf:otp:<userID>:<purpose>
func OTPCodeKey(userID, purpose string) string {
	return fmt.Sprintf("mf:otp:%s:%s", userID, purpose)
}

// OTPRateLimitKey returns the Redis key for OTP request rate limiting.
// Pattern: mf:otp:ratelimit:<userID>:<purpose>
func OTPRateLimitKey(userID, purpose string) string {
	return fmt.Sprintf("mf:otp:ratelimit:%s:%s", userID, purpose)
}

// EffectiveMailSMTPKey returns the Redis key for cached resolved SMTP config JSON.
// keyPrefix is cfg.Cache.KeyPrefix (often empty).
func EffectiveMailSMTPKey(keyPrefix string) string {
	return keyPrefix + "mf:mail:smtp_effective"
}

// AdminMailTestRateLimitKey rate-limits adminSendTestMail per admin user ID.
func AdminMailTestRateLimitKey(adminUserID string) string {
	return fmt.Sprintf("mf:mail:admin_test_rl:%s", adminUserID)
}

// PasswordResetEmailRateLimitKey rate-limits requestPasswordReset per normalized email (hashed id in key).
func PasswordResetEmailRateLimitKey(emailKey string) string {
	return fmt.Sprintf("mf:auth:pwreset:email:%s", emailKey)
}

// PasswordResetIPRateLimitKey rate-limits requestPasswordReset per client IP.
func PasswordResetIPRateLimitKey(ip string) string {
	return fmt.Sprintf("mf:auth:pwreset:ip:%s", ip)
}

// LoginRateLimitEmailKey rate-limits failed login attempts per normalized email (SHA-256 hex).
func LoginRateLimitEmailKey(email string) string {
	n := strings.ToLower(strings.TrimSpace(email))
	sum := sha256.Sum256([]byte(n))
	return fmt.Sprintf("mf:auth:login_rl:email:%s", hex.EncodeToString(sum[:]))
}

// LoginRateLimitIPKey rate-limits failed login attempts per client IP (after chi RealIP).
func LoginRateLimitIPKey(ip string) string {
	return fmt.Sprintf("mf:auth:login_rl:ip:%s", ip)
}

// OneSignalScheduledUserTodoKey stores the OneSignal notification id for a scheduled user-todo due reminder.
// keyPrefix is cfg.Cache.KeyPrefix (often empty). kind distinguishes user vs project todos internally.
func OneSignalScheduledUserTodoKey(keyPrefix, todoID string) string {
	return keyPrefix + fmt.Sprintf("mf:os:todo_due:user:%s", todoID)
}

// OneSignalScheduledOrgProjectTodoKey stores the OneSignal notification id for a project todo due reminder.
func OneSignalScheduledOrgProjectTodoKey(keyPrefix, todoID string) string {
	return keyPrefix + fmt.Sprintf("mf:os:todo_due:org_project:%s", todoID)
}
