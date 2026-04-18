package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/masterfabric/masterfabric_go_basic/internal/application/auth/dto"
	otpDTO "github.com/masterfabric/masterfabric_go_basic/internal/application/otp/dto"
	otpUC "github.com/masterfabric/masterfabric_go_basic/internal/application/otp/usecase"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	infraAuth "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/auth"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/session"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/validation"
)

// ResetPasswordWithOTPUseCase verifies a PASSWORD_RESET OTP and sets a new password.
type ResetPasswordWithOTPUseCase struct {
	userRepo    repository.UserRepository
	verifyOTP   *otpUC.VerifyOTPUseCase
	jwtSvc      *infraAuth.JWTService
	sessionRepo *session.SessionRepo
}

// NewResetPasswordWithOTPUseCase constructs the use case. sessionRepo may be nil.
func NewResetPasswordWithOTPUseCase(
	userRepo repository.UserRepository,
	verifyOTP *otpUC.VerifyOTPUseCase,
	jwtSvc *infraAuth.JWTService,
	sessionRepo *session.SessionRepo,
) *ResetPasswordWithOTPUseCase {
	return &ResetPasswordWithOTPUseCase{
		userRepo:    userRepo,
		verifyOTP:   verifyOTP,
		jwtSvc:      jwtSvc,
		sessionRepo: sessionRepo,
	}
}

// Execute verifies the code and updates the password; revokes existing sessions.
func (uc *ResetPasswordWithOTPUseCase) Execute(ctx context.Context, req *dto.ResetPasswordWithOtpRequest) error {
	if err := validation.Struct(req); err != nil {
		return err
	}
	email := strings.TrimSpace(req.Email)

	user, err := uc.userRepo.FindByEmail(ctx, email)
	if err != nil {
		if domainErr.Is(err, domainErr.ErrUserNotFound) {
			return domainErr.ErrInvalidCredentials
		}
		return err
	}
	if user == nil {
		return domainErr.ErrInvalidCredentials
	}
	if user.Status != model.UserStatusActive {
		return domainErr.ErrAccountDisabled
	}

	_, err = uc.verifyOTP.Execute(ctx, &otpDTO.VerifyOTPRequest{
		UserID:  user.ID.String(),
		Code:    strings.TrimSpace(req.Code),
		Purpose: "password_reset",
	})
	if err != nil {
		return domainErr.ErrInvalidCredentials
	}

	hash, err := infraAuth.HashPassword(req.NewPassword)
	if err != nil {
		return fmt.Errorf("resetPasswordWithOtp: hash: %w", err)
	}
	user.PasswordHash = hash
	user.UpdatedAt = time.Now().UTC()
	if err := uc.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("resetPasswordWithOtp: update user: %w", err)
	}

	_ = uc.jwtSvc.MarkUserAccessRevoked(ctx, user.ID)
	_ = uc.jwtSvc.DeleteAllRefreshTokensForUser(ctx, user.ID)
	if uc.sessionRepo != nil {
		_ = uc.sessionRepo.DeleteAllForUser(ctx, user.ID)
	}
	return nil
}
