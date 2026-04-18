package otp

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/otp/model"
)

const (
	sqlCreateOTP = `
		INSERT INTO otp_codes (id, user_id, code, channel, purpose, status, attempts, max_retries, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	sqlFindByID = `
		SELECT id, user_id, code, channel, purpose, status, attempts, max_retries, expires_at, verified_at, created_at
		FROM otp_codes WHERE id = $1`

	sqlFindPendingByUser = `
		SELECT id, user_id, code, channel, purpose, status, attempts, max_retries, expires_at, verified_at, created_at
		FROM otp_codes
		WHERE user_id = $1 AND purpose = $2 AND status = 'pending' AND expires_at > NOW()
		ORDER BY created_at DESC LIMIT 1`

	sqlMarkVerified = `
		UPDATE otp_codes SET status = 'verified', verified_at = NOW() WHERE id = $1`

	sqlIncrementAttempts = `
		UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`

	sqlMarkExpired = `
		UPDATE otp_codes SET status = 'expired' WHERE id = $1`

	sqlExpireAllPending = `
		UPDATE otp_codes SET status = 'expired'
		WHERE user_id = $1 AND purpose = $2 AND status = 'pending'`

	sqlUpdateChannel = `
		UPDATE otp_codes SET channel = $1 WHERE id = $2`

	sqlListByUserID = `
		SELECT id, user_id, code, channel, purpose, status, attempts, max_retries, expires_at, verified_at, created_at
		FROM otp_codes WHERE user_id = $1
		ORDER BY created_at DESC LIMIT $2 OFFSET $3`

	sqlListPending = `
		SELECT id, user_id, code, channel, purpose, status, attempts, max_retries, expires_at, verified_at, created_at
		FROM otp_codes WHERE status = 'pending' AND expires_at > NOW()
		ORDER BY created_at DESC LIMIT $1 OFFSET $2`
)

type OTPRepo struct {
	db *pgxpool.Pool
}

func NewOTPRepo(db *pgxpool.Pool) *OTPRepo {
	return &OTPRepo{db: db}
}

func (r *OTPRepo) Create(ctx context.Context, o *model.OTPCode) error {
	_, err := r.db.Exec(ctx, sqlCreateOTP,
		o.ID, o.UserID, o.Code, o.Channel, o.Purpose, o.Status,
		o.Attempts, o.MaxRetries, o.ExpiresAt, o.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("otpRepo.Create: %w", err)
	}
	return nil
}

func (r *OTPRepo) FindByID(ctx context.Context, id uuid.UUID) (*model.OTPCode, error) {
	return r.scanOne(r.db.QueryRow(ctx, sqlFindByID, id))
}

func (r *OTPRepo) FindPendingByUserID(ctx context.Context, userID uuid.UUID, purpose model.OTPPurpose) (*model.OTPCode, error) {
	return r.scanOne(r.db.QueryRow(ctx, sqlFindPendingByUser, userID, purpose))
}

func (r *OTPRepo) MarkVerified(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, sqlMarkVerified, id)
	if err != nil {
		return fmt.Errorf("otpRepo.MarkVerified: %w", err)
	}
	return nil
}

func (r *OTPRepo) IncrementAttempts(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, sqlIncrementAttempts, id)
	if err != nil {
		return fmt.Errorf("otpRepo.IncrementAttempts: %w", err)
	}
	return nil
}

func (r *OTPRepo) MarkExpired(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, sqlMarkExpired, id)
	if err != nil {
		return fmt.Errorf("otpRepo.MarkExpired: %w", err)
	}
	return nil
}

func (r *OTPRepo) ExpireAllPendingForUser(ctx context.Context, userID uuid.UUID, purpose model.OTPPurpose) error {
	_, err := r.db.Exec(ctx, sqlExpireAllPending, userID, purpose)
	if err != nil {
		return fmt.Errorf("otpRepo.ExpireAllPending: %w", err)
	}
	return nil
}

func (r *OTPRepo) UpdateChannel(ctx context.Context, id uuid.UUID, channel model.OTPChannel) error {
	_, err := r.db.Exec(ctx, sqlUpdateChannel, channel, id)
	if err != nil {
		return fmt.Errorf("otpRepo.UpdateChannel: %w", err)
	}
	return nil
}

func (r *OTPRepo) ListByUserID(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*model.OTPCode, error) {
	rows, err := r.db.Query(ctx, sqlListByUserID, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("otpRepo.ListByUserID: %w", err)
	}
	defer rows.Close()
	return r.scanMany(rows)
}

func (r *OTPRepo) ListPending(ctx context.Context, limit, offset int) ([]*model.OTPCode, error) {
	rows, err := r.db.Query(ctx, sqlListPending, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("otpRepo.ListPending: %w", err)
	}
	defer rows.Close()
	return r.scanMany(rows)
}

// ── scan helpers ────────────────────────────────────────────────────────────

type scannable interface {
	Scan(dest ...any) error
}

func (r *OTPRepo) scanOne(row scannable) (*model.OTPCode, error) {
	o := &model.OTPCode{}
	err := row.Scan(
		&o.ID, &o.UserID, &o.Code, &o.Channel, &o.Purpose, &o.Status,
		&o.Attempts, &o.MaxRetries, &o.ExpiresAt, &o.VerifiedAt, &o.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("otpRepo.scan: %w", err)
	}
	return o, nil
}

type rowsScanner interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}

func (r *OTPRepo) scanMany(rows rowsScanner) ([]*model.OTPCode, error) {
	var result []*model.OTPCode
	for rows.Next() {
		o := &model.OTPCode{}
		if err := rows.Scan(
			&o.ID, &o.UserID, &o.Code, &o.Channel, &o.Purpose, &o.Status,
			&o.Attempts, &o.MaxRetries, &o.ExpiresAt, &o.VerifiedAt, &o.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("otpRepo.scanMany: %w", err)
		}
		result = append(result, o)
	}
	return result, rows.Err()
}
