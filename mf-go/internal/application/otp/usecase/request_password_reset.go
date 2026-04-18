package usecase

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"strings"
	"time"

	"github.com/masterfabric/masterfabric_go_basic/internal/application/otp/dto"
	iammodel "github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
)

const (
	passwordResetEmailRateLimitTTL = time.Hour
	passwordResetIPRateLimitTTL    = time.Hour
	passwordResetMaxPerEmail       = 5
	passwordResetMaxPerIP          = 30
)

// RequestPasswordResetUseCase sends a PASSWORD_RESET OTP email when the account exists and is active.
// Always appears successful to callers (anti-enumeration).
type RequestPasswordResetUseCase struct {
	users      repository.UserRepository
	requestOTP *RequestOTPUseCase
	cache      *infraRedis.CacheHandler
}

// NewRequestPasswordResetUseCase constructs the use case.
func NewRequestPasswordResetUseCase(
	users repository.UserRepository,
	requestOTP *RequestOTPUseCase,
	cache *infraRedis.CacheHandler,
) *RequestPasswordResetUseCase {
	return &RequestPasswordResetUseCase{users: users, requestOTP: requestOTP, cache: cache}
}

func normalizedEmailKey(email string) string {
	n := strings.ToLower(strings.TrimSpace(email))
	sum := sha256.Sum256([]byte(n))
	return hex.EncodeToString(sum[:])
}

// Execute triggers a password-reset OTP email when appropriate. clientIP may be empty.
func (uc *RequestPasswordResetUseCase) Execute(ctx context.Context, email string, clientIP string) error {
	email = strings.TrimSpace(email)
	if email == "" {
		return nil
	}

	if uc.cache.Available() {
		ek := infraRedis.PasswordResetEmailRateLimitKey(normalizedEmailKey(email))
		n, _ := uc.cache.IncrWithExpiry(ctx, ek, passwordResetEmailRateLimitTTL)
		if n > passwordResetMaxPerEmail {
			return nil
		}
		if clientIP != "" {
			ik := infraRedis.PasswordResetIPRateLimitKey(clientIP)
			n2, _ := uc.cache.IncrWithExpiry(ctx, ik, passwordResetIPRateLimitTTL)
			if n2 > passwordResetMaxPerIP {
				return nil
			}
		}
	}

	user, err := uc.users.FindByEmail(ctx, email)
	if err != nil || user == nil {
		return nil
	}
	if user.Status != iammodel.UserStatusActive {
		return nil
	}

	if _, err := uc.requestOTP.Execute(ctx, &dto.RequestOTPRequest{
		UserID:  user.ID.String(),
		Purpose: "password_reset",
	}); err != nil {
		slog.Warn("requestPasswordReset: OTP create or delivery failed (check OTP_DELIVERY, SMTP, otp_email_enabled)",
			slog.String("user_id", user.ID.String()),
			slog.Any("error", err))
	}
	return nil
}
