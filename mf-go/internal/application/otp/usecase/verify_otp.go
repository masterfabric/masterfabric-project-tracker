package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/otp/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/repository"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/validation"
)

// VerifyOTPUseCase validates a user-supplied code against the active OTP.
type VerifyOTPUseCase struct {
	otpRepo repository.OTPRepository
	cache   *infraRedis.CacheHandler
}

func NewVerifyOTPUseCase(
	otpRepo repository.OTPRepository,
	cache *infraRedis.CacheHandler,
) *VerifyOTPUseCase {
	return &VerifyOTPUseCase{otpRepo: otpRepo, cache: cache}
}

func (uc *VerifyOTPUseCase) Execute(ctx context.Context, req *dto.VerifyOTPRequest) (*dto.VerifyOTPResponse, error) {
	if err := validation.Struct(req); err != nil {
		return nil, err
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, domainErr.ErrTokenInvalid
	}

	purpose := model.OTPPurpose(req.Purpose)

	// Fast path: check Redis cache
	if uc.cache.Available() {
		cacheKey := infraRedis.OTPCodeKey(userID.String(), string(purpose))
		val, found, _ := uc.cache.Get(ctx, cacheKey)
		if found {
			// val = "otpID:code"
			parts := strings.SplitN(val, ":", 2)
			if len(parts) == 2 && parts[1] == req.Code {
				otpID, _ := uuid.Parse(parts[0])
				_ = uc.otpRepo.MarkVerified(ctx, otpID)
				_ = uc.cache.Del(ctx, cacheKey)
				return &dto.VerifyOTPResponse{Verified: true, OTPID: otpID.String()}, nil
			}
		}
	}

	// Slow path: look up in Postgres
	otp, err := uc.otpRepo.FindPendingByUserID(ctx, userID, purpose)
	if err != nil || otp == nil {
		return nil, domainErr.New("OTP_NOT_FOUND", "no pending OTP found", nil)
	}

	if otp.IsExpired() {
		_ = uc.otpRepo.MarkExpired(ctx, otp.ID)
		return nil, domainErr.New("OTP_EXPIRED", "OTP code has expired", nil)
	}

	if otp.IsMaxAttemptsReached() {
		_ = uc.otpRepo.MarkExpired(ctx, otp.ID)
		return nil, domainErr.New("OTP_MAX_ATTEMPTS", "maximum verification attempts exceeded", nil)
	}

	_ = uc.otpRepo.IncrementAttempts(ctx, otp.ID)

	if otp.Code != req.Code {
		remaining := otp.MaxRetries - otp.Attempts - 1
		return nil, domainErr.New("OTP_INVALID", fmt.Sprintf("invalid code, %d attempts remaining", remaining), nil)
	}

	_ = uc.otpRepo.MarkVerified(ctx, otp.ID)
	if uc.cache.Available() {
		_ = uc.cache.Del(ctx, infraRedis.OTPCodeKey(userID.String(), string(purpose)))
	}

	now := time.Now().UTC()
	otp.Status = model.OTPStatusVerified
	otp.VerifiedAt = &now

	return &dto.VerifyOTPResponse{Verified: true, OTPID: otp.ID.String()}, nil
}
