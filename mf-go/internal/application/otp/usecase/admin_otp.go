package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/otp/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/repository"
)

// AdminListPendingOTPsUseCase returns all active/pending OTPs for the admin dashboard.
type AdminListPendingOTPsUseCase struct {
	otpRepo repository.OTPRepository
}

func NewAdminListPendingOTPsUseCase(otpRepo repository.OTPRepository) *AdminListPendingOTPsUseCase {
	return &AdminListPendingOTPsUseCase{otpRepo: otpRepo}
}

func (uc *AdminListPendingOTPsUseCase) Execute(ctx context.Context, limit, offset int) ([]*dto.AdminOTPResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 50
	}
	otps, err := uc.otpRepo.ListPending(ctx, limit, offset)
	if err != nil {
		return nil, err
	}
	return toAdminOTPResponses(otps), nil
}

// AdminUserOTPHistoryUseCase returns OTP history for a specific user.
type AdminUserOTPHistoryUseCase struct {
	otpRepo repository.OTPRepository
}

func NewAdminUserOTPHistoryUseCase(otpRepo repository.OTPRepository) *AdminUserOTPHistoryUseCase {
	return &AdminUserOTPHistoryUseCase{otpRepo: otpRepo}
}

func (uc *AdminUserOTPHistoryUseCase) Execute(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*dto.AdminOTPResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 50
	}
	otps, err := uc.otpRepo.ListByUserID(ctx, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	return toAdminOTPResponses(otps), nil
}

func toAdminOTPResponses(otps []*model.OTPCode) []*dto.AdminOTPResponse {
	result := make([]*dto.AdminOTPResponse, 0, len(otps))
	for _, o := range otps {
		result = append(result, &dto.AdminOTPResponse{
			ID:         o.ID.String(),
			UserID:     o.UserID.String(),
			Code:       o.Code,
			Channel:    string(o.Channel),
			Purpose:    string(o.Purpose),
			Status:     string(o.Status),
			Attempts:   o.Attempts,
			MaxRetries: o.MaxRetries,
			ExpiresAt:  o.ExpiresAt,
			VerifiedAt: o.VerifiedAt,
			CreatedAt:  o.CreatedAt,
		})
	}
	return result
}
