package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/device/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/device/model"
	deviceRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/device/repository"
)

// RegisterDeviceUseCase handles registering or updating a user device.
type RegisterDeviceUseCase struct {
	repo deviceRepo.DeviceRepository
}

// NewRegisterDeviceUseCase constructs a RegisterDeviceUseCase.
func NewRegisterDeviceUseCase(repo deviceRepo.DeviceRepository) *RegisterDeviceUseCase {
	return &RegisterDeviceUseCase{repo: repo}
}

// Execute registers or updates a device for the given user.
func (uc *RegisterDeviceUseCase) Execute(ctx context.Context, req *dto.RegisterDeviceRequest) (*dto.DeviceResponse, error) {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, fmt.Errorf("registerDevice: invalid user ID: %w", err)
	}

	now := time.Now().UTC()
	device := &model.UserDevice{
		ID:         uuid.New(),
		UserID:     userID,
		DeviceID:   req.DeviceID,
		Platform:   req.Platform,
		DeviceName: req.DeviceName,
		Model:      req.Model,
		Brand:      req.Brand,
		OSName:     req.OSName,
		OSVersion:  req.OSVersion,
		AppName:    req.AppName,
		AppVersion: req.AppVersion,
		AppBuild:   req.AppBuild,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := uc.repo.Upsert(ctx, device); err != nil {
		return nil, fmt.Errorf("registerDevice: %w", err)
	}

	return &dto.DeviceResponse{
		ID:         device.ID.String(),
		UserID:     device.UserID.String(),
		DeviceID:   device.DeviceID,
		Platform:   device.Platform,
		DeviceName: device.DeviceName,
		Model:      device.Model,
		Brand:      device.Brand,
		OSName:     device.OSName,
		OSVersion:  device.OSVersion,
		AppName:    device.AppName,
		AppVersion: device.AppVersion,
		AppBuild:   device.AppBuild,
		CreatedAt:  device.CreatedAt.Format(time.RFC3339),
		UpdatedAt:  device.UpdatedAt.Format(time.RFC3339),
	}, nil
}
