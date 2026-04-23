package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// TokenPair holds a short-lived access token and long-lived refresh token.
type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresIn    int64 // seconds until access token expiry
}

// Claims is the JWT claims payload.
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// JWTService handles JWT creation and validation plus refresh token storage in
// the cache. It delegates all Redis I/O to CacheHandler so no raw Redis
// client escapes this package boundary.
type JWTService struct {
	cfg   config.JWTConfig
	cache *infraRedis.CacheHandler
	log   *slog.Logger
}

// NewJWTService creates a JWTService. cache may wrap a nil Redis client
// (tokens won't be blacklisted / refresh tokens won't be stored).
// log may be nil; eviction events use slog.Default().
func NewJWTService(cfg config.JWTConfig, cache *infraRedis.CacheHandler, log *slog.Logger) *JWTService {
	if log == nil {
		log = slog.Default()
	}
	return &JWTService{cfg: cfg, cache: cache, log: log}
}

// GenerateTokenPair creates an access + refresh token pair for the given user.
func (s *JWTService) GenerateTokenPair(ctx context.Context, userID uuid.UUID, email, role string) (*TokenPair, error) {
	now := time.Now()

	// Access token
	accessClaims := Claims{
		UserID: userID.String(),
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.AccessTokenTTL)),
			ID:        uuid.New().String(), // jti avoids identical HS256 strings within the same iat second (e.g. after logout + login)
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessSigned, err := accessToken.SignedString([]byte(s.cfg.Secret))
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	if !s.cache.Available() {
		return nil, domainErr.ErrSessionStoreUnavailable
	}

	// Refresh token (opaque UUID stored in cache as "email:role")
	refreshToken := uuid.New().String()
	key := infraRedis.RefreshTokenKey(userID.String(), refreshToken)
	value := email + ":" + role
	if err := s.cache.Set(ctx, key, value, s.cfg.RefreshTokenTTL); err != nil {
		return nil, fmt.Errorf("store refresh token: %w", err)
	}
	if err := s.enforceRefreshTokenLimit(ctx, userID); err != nil {
		return nil, fmt.Errorf("enforce refresh session limit: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessSigned,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.cfg.AccessTokenTTL.Seconds()),
	}, nil
}

// ValidateAccessToken parses and validates a JWT access token.
func (s *JWTService) ValidateAccessToken(ctx context.Context, tokenStr string) (*Claims, error) {
	// Check blacklist first
	if s.cache.Available() {
		blacklisted, err := s.cache.Exists(ctx, infraRedis.TokenBlacklistKey(tokenStr))
		if err == nil && blacklisted {
			return nil, domainErr.ErrTokenInvalid
		}
	}

	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.cfg.Secret), nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, domainErr.ErrTokenExpired
		}
		return nil, domainErr.ErrTokenInvalid
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, domainErr.ErrTokenInvalid
	}

	// Admin deactivated / suspended: reject access tokens issued before revocation marker (Redis).
	if claims.IssuedAt != nil {
		uid, err := uuid.Parse(claims.UserID)
		if err == nil && s.isAccessRevokedForUser(ctx, uid, claims.IssuedAt.Time) {
			return nil, domainErr.ErrTokenInvalid
		}
	}

	return claims, nil
}

// isAccessRevokedForUser returns true if there is a revocation marker and tokenIat is not after it.
func (s *JWTService) isAccessRevokedForUser(ctx context.Context, userID uuid.UUID, tokenIat time.Time) bool {
	if !s.cache.Available() {
		return false
	}
	key := infraRedis.UserAccessRevokedAtKey(userID.String())
	val, found, err := s.cache.Get(ctx, key)
	if err != nil || !found {
		return false
	}
	sec, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return false
	}
	revokedAt := time.Unix(sec, 0).UTC()
	return !tokenIat.UTC().After(revokedAt)
}

// MarkUserAccessRevoked invalidates existing access tokens (by iat) until Redis key expires.
func (s *JWTService) MarkUserAccessRevoked(ctx context.Context, userID uuid.UUID) error {
	if !s.cache.Available() {
		return nil
	}
	ttl := 2 * s.cfg.AccessTokenTTL
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	key := infraRedis.UserAccessRevokedAtKey(userID.String())
	val := strconv.FormatInt(time.Now().UTC().Unix(), 10)
	return s.cache.Set(ctx, key, val, ttl)
}

// ClearUserAccessRevoked removes the forced-logout marker (e.g. admin re-activated account).
func (s *JWTService) ClearUserAccessRevoked(ctx context.Context, userID uuid.UUID) error {
	if !s.cache.Available() {
		return nil
	}
	return s.cache.Del(ctx, infraRedis.UserAccessRevokedAtKey(userID.String()))
}

// DeleteAllRefreshTokensForUser removes every stored refresh token for the user (SCAN).
func (s *JWTService) DeleteAllRefreshTokensForUser(ctx context.Context, userID uuid.UUID) error {
	if !s.cache.Available() {
		return nil
	}
	return s.cache.DeleteKeysMatch(ctx, infraRedis.RefreshTokenPatternForUser(userID.String()))
}

// DeleteOneRefreshToken removes a single refresh token entry (e.g. disabled account).
func (s *JWTService) DeleteOneRefreshToken(ctx context.Context, userID uuid.UUID, refreshToken string) error {
	if !s.cache.Available() {
		return nil
	}
	return s.cache.Del(ctx, infraRedis.RefreshTokenKey(userID.String(), refreshToken))
}

// RefreshTokens validates a refresh token and issues a new pair.
func (s *JWTService) RefreshTokens(ctx context.Context, userID uuid.UUID, refreshToken string) (*TokenPair, error) {
	if !s.cache.Available() {
		return nil, domainErr.ErrTokenInvalid
	}

	key := infraRedis.RefreshTokenKey(userID.String(), refreshToken)
	// Single atomic read-and-remove so concurrent refresh attempts cannot both succeed.
	value, found, err := s.cache.GetDel(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("get refresh token: %w", err)
	}
	if !found {
		return nil, domainErr.ErrTokenInvalid
	}

	// value is "email:role"
	parts := strings.SplitN(value, ":", 2)
	email := parts[0]
	role := "user"
	if len(parts) == 2 {
		role = parts[1]
	}

	pair, genErr := s.GenerateTokenPair(ctx, userID, email, role)
	if genErr != nil {
		// Old refresh was already consumed (GetDel). Restore so the client can retry
		// after transient failures (Redis blip, session limit) instead of stranding the session.
		_ = s.cache.Set(ctx, key, value, s.cfg.RefreshTokenTTL)
		return nil, genErr
	}
	return pair, nil
}

// enforceRefreshTokenLimit removes oldest refresh-token keys (shortest remaining TTL first)
// when a user exceeds MaxRefreshTokensPerUser. No-op when max <= 0.
func (s *JWTService) enforceRefreshTokenLimit(ctx context.Context, userID uuid.UUID) error {
	max := s.cfg.MaxRefreshTokensPerUser
	if max <= 0 || !s.cache.Available() {
		return nil
	}
	pattern := infraRedis.RefreshTokenPatternForUser(userID.String())
	keys, err := s.cache.ListKeysMatch(ctx, pattern)
	if err != nil {
		return err
	}
	if len(keys) <= max {
		return nil
	}
	type keyTTL struct {
		key string
		ttl time.Duration
	}
	rows := make([]keyTTL, 0, len(keys))
	for _, k := range keys {
		ttl, err := s.cache.TTL(ctx, k)
		if err != nil {
			continue
		}
		if ttl < 0 {
			continue
		}
		rows = append(rows, keyTTL{key: k, ttl: ttl})
	}
	if len(rows) == 0 {
		return nil
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].ttl < rows[j].ttl })
	excess := len(keys) - max
	evicted := 0
	for i := 0; i < excess && i < len(rows); i++ {
		if err := s.cache.Del(ctx, rows[i].key); err == nil {
			evicted++
		}
	}
	if evicted > 0 {
		s.log.Warn("auth refresh sessions evicted (per-user cap)",
			slog.String("event", "refresh_session_eviction"),
			slog.String("user_id", userID.String()),
			slog.Int("evicted", evicted),
			slog.Int("max_sessions", max),
			slog.Int("session_count_before", len(keys)),
		)
	}
	return nil
}

// RevokeTokens blacklists the access token and deletes the refresh token.
func (s *JWTService) RevokeTokens(ctx context.Context, userID uuid.UUID, accessToken, refreshToken string) error {
	if !s.cache.Available() {
		return nil
	}

	// Parse to get remaining TTL for blacklist expiry
	claims, err := s.ValidateAccessToken(ctx, accessToken)
	if err == nil && claims != nil {
		ttl := time.Until(claims.ExpiresAt.Time)
		if ttl > 0 {
			_ = s.cache.Set(ctx, infraRedis.TokenBlacklistKey(accessToken), "1", ttl)
		}
	}

	// Delete refresh token
	_ = s.cache.Del(ctx, infraRedis.RefreshTokenKey(userID.String(), refreshToken))
	return nil
}
