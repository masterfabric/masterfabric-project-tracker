package usecase

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/otp/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/provider"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/repository"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/validation"
)

const (
	otpLength       = 6
	otpTTL          = 5 * time.Minute
	otpMaxRetries   = 5
	otpRateLimitTTL = 1 * time.Minute
)

// RequestOTPUseCase generates a new OTP code and delivers it via the configured provider.
type RequestOTPUseCase struct {
	otpRepo  repository.OTPRepository
	provider provider.DeliveryProvider
	cache    *infraRedis.CacheHandler
}

func NewRequestOTPUseCase(
	otpRepo repository.OTPRepository,
	provider provider.DeliveryProvider,
	cache *infraRedis.CacheHandler,
) *RequestOTPUseCase {
	return &RequestOTPUseCase{otpRepo: otpRepo, provider: provider, cache: cache}
}

func (uc *RequestOTPUseCase) Execute(ctx context.Context, req *dto.RequestOTPRequest) (*dto.RequestOTPResponse, error) {
	if err := validation.Struct(req); err != nil {
		return nil, err
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, domainErr.ErrTokenInvalid
	}

	purpose := model.OTPPurpose(req.Purpose)

	// Idempotent: if a non-expired pending OTP already exists for this user+purpose,
	// return it without consuming the rate limit (avoids OTP_RATE_LIMITED on retries /
	// double toggles while the same code is still valid).
	existing, findErr := uc.otpRepo.FindPendingByUserID(ctx, userID, purpose)
	if findErr == nil && existing != nil && !existing.IsExpired() && !existing.IsMaxAttemptsReached() {
		if uc.cache.Available() {
			ttl := time.Until(existing.ExpiresAt.UTC())
			if ttl > 0 {
				cacheKey := infraRedis.OTPCodeKey(userID.String(), string(purpose))
				val := fmt.Sprintf("%s:%s", existing.ID.String(), existing.Code)
				_ = uc.cache.Set(ctx, cacheKey, val, ttl)
			}
		}
		// Always attempt delivery again (e.g. first SMTP send failed but row + idempotent path stayed pending).
		if err := uc.provider.Send(ctx, userID.String(), existing.Code, purpose); err != nil {
			return nil, fmt.Errorf("requestOTP: deliver: %w", err)
		}
		storageCh := uc.provider.StorageChannel(ctx, purpose)
		if storageCh != existing.Channel {
			_ = uc.otpRepo.UpdateChannel(ctx, existing.ID, storageCh)
		}
		return &dto.RequestOTPResponse{
			OTPID:     existing.ID.String(),
			Channel:   string(storageCh),
			ExpiresAt: existing.ExpiresAt,
		}, nil
	}

	// Rate limit: max 1 new OTP per minute per user per purpose
	if uc.cache.Available() {
		rlKey := infraRedis.OTPRateLimitKey(userID.String(), string(purpose))
		exists, _ := uc.cache.Exists(ctx, rlKey)
		if exists {
			return nil, domainErr.New("OTP_RATE_LIMITED", "please wait before requesting another code", nil)
		}
		_ = uc.cache.Set(ctx, rlKey, "1", otpRateLimitTTL)
	}

	// Expire any previous pending OTPs for this user+purpose
	_ = uc.otpRepo.ExpireAllPendingForUser(ctx, userID, purpose)

	code := generateCode(otpLength)
	now := time.Now().UTC()

	otpEntry := &model.OTPCode{
		ID:         uuid.New(),
		UserID:     userID,
		Code:       code,
		Channel:    uc.provider.StorageChannel(ctx, purpose),
		Purpose:    purpose,
		Status:     model.OTPStatusPending,
		Attempts:   0,
		MaxRetries: otpMaxRetries,
		ExpiresAt:  now.Add(otpTTL),
		CreatedAt:  now,
	}

	if err := uc.otpRepo.Create(ctx, otpEntry); err != nil {
		return nil, fmt.Errorf("requestOTP: create: %w", err)
	}

	// Cache the code in Redis for fast lookup during verification
	cacheKey := infraRedis.OTPCodeKey(userID.String(), string(purpose))
	if uc.cache.Available() {
		val := fmt.Sprintf("%s:%s", otpEntry.ID.String(), code)
		_ = uc.cache.Set(ctx, cacheKey, val, otpTTL)
	}

	// Deliver via the configured provider
	if err := uc.provider.Send(ctx, userID.String(), code, purpose); err != nil {
		_ = uc.otpRepo.MarkExpired(ctx, otpEntry.ID)
		if uc.cache.Available() {
			_ = uc.cache.Del(ctx, cacheKey)
		}
		return nil, fmt.Errorf("requestOTP: deliver: %w", err)
	}

	return &dto.RequestOTPResponse{
		OTPID:     otpEntry.ID.String(),
		Channel:   string(otpEntry.Channel),
		ExpiresAt: otpEntry.ExpiresAt,
	}, nil
}

func generateCode(length int) string {
	code := make([]byte, length)
	for i := range code {
		n, _ := rand.Int(rand.Reader, big.NewInt(10))
		code[i] = byte('0' + n.Int64())
	}
	return string(code)
}
