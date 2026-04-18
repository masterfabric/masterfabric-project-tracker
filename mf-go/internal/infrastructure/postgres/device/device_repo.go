package device

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/device/model"
)

// DeviceRepo is the PostgreSQL implementation of domain DeviceRepository.
type DeviceRepo struct {
	db *pgxpool.Pool
}

// NewDeviceRepo creates a new DeviceRepo.
func NewDeviceRepo(db *pgxpool.Pool) *DeviceRepo {
	return &DeviceRepo{db: db}
}

const (
	sqlUpsertDevice = `
		INSERT INTO user_devices
		    (id, user_id, device_id, platform, device_name, model, brand,
		     os_name, os_version, app_name, app_version, app_build, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (user_id, device_id) DO UPDATE
		    SET platform    = EXCLUDED.platform,
		        device_name = EXCLUDED.device_name,
		        model       = EXCLUDED.model,
		        brand       = EXCLUDED.brand,
		        os_name     = EXCLUDED.os_name,
		        os_version  = EXCLUDED.os_version,
		        app_name    = EXCLUDED.app_name,
		        app_version = EXCLUDED.app_version,
		        app_build   = EXCLUDED.app_build,
		        updated_at  = EXCLUDED.updated_at`

	sqlListDevicesByUserID = `
		SELECT id, user_id, device_id, platform, device_name, model, brand,
		       os_name, os_version, app_name, app_version, app_build, created_at, updated_at
		FROM user_devices
		WHERE user_id = $1
		ORDER BY updated_at DESC`
)

// Upsert inserts a new device or updates an existing one (by user_id + device_id).
func (r *DeviceRepo) Upsert(ctx context.Context, d *model.UserDevice) error {
	_, err := r.db.Exec(ctx, sqlUpsertDevice,
		d.ID, d.UserID, d.DeviceID, d.Platform, d.DeviceName, d.Model, d.Brand,
		d.OSName, d.OSVersion, d.AppName, d.AppVersion, d.AppBuild,
		d.CreatedAt, d.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("deviceRepo.Upsert: %w", err)
	}
	return nil
}

// ListByUserID returns all devices registered for the given user.
func (r *DeviceRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*model.UserDevice, error) {
	rows, err := r.db.Query(ctx, sqlListDevicesByUserID, userID)
	if err != nil {
		return nil, fmt.Errorf("deviceRepo.ListByUserID: %w", err)
	}
	defer rows.Close()

	var results []*model.UserDevice
	for rows.Next() {
		d, err := scanDevice(rows)
		if err != nil {
			return nil, fmt.Errorf("deviceRepo.ListByUserID scan: %w", err)
		}
		results = append(results, d)
	}

	return results, nil
}

func scanDevice(row pgx.Row) (*model.UserDevice, error) {
	var d model.UserDevice
	err := row.Scan(
		&d.ID, &d.UserID, &d.DeviceID, &d.Platform, &d.DeviceName, &d.Model, &d.Brand,
		&d.OSName, &d.OSVersion, &d.AppName, &d.AppVersion, &d.AppBuild,
		&d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}
