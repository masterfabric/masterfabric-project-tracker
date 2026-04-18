package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
)

// OTPRepository defines persistence operations for OTP codes.
type OTPRepository interface {
	// Create persists a new OTP record (audit log in Postgres).
	Create(ctx context.Context, otp *model.OTPCode) error

	// FindByID returns a single OTP by its ID.
	FindByID(ctx context.Context, id uuid.UUID) (*model.OTPCode, error)

	// FindPendingByUserID returns the most recent pending (non-expired, non-verified) OTP for a user.
	FindPendingByUserID(ctx context.Context, userID uuid.UUID, purpose model.OTPPurpose) (*model.OTPCode, error)

	// MarkVerified updates the OTP status to verified and sets verified_at.
	MarkVerified(ctx context.Context, id uuid.UUID) error

	// IncrementAttempts bumps the attempt counter by 1.
	IncrementAttempts(ctx context.Context, id uuid.UUID) error

	// MarkExpired updates the OTP status to expired.
	MarkExpired(ctx context.Context, id uuid.UUID) error

	// ExpireAllPendingForUser marks all pending OTPs for a user+purpose as expired.
	ExpireAllPendingForUser(ctx context.Context, userID uuid.UUID, purpose model.OTPPurpose) error

	// UpdateChannel sets the delivery channel on a row (e.g. after SMTP bridge redelivery).
	UpdateChannel(ctx context.Context, id uuid.UUID, channel model.OTPChannel) error

	// ListByUserID returns OTP history for a user (for admin views), newest first.
	ListByUserID(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*model.OTPCode, error)

	// ListPending returns all pending OTPs across users (admin dashboard), newest first.
	ListPending(ctx context.Context, limit, offset int) ([]*model.OTPCode, error)
}
