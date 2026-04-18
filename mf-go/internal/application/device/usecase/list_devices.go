package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/device/dto"
	deviceRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/device/repository"
)

// ListDevicesUseCase returns all devices belonging to a user.
type ListDevicesUseCase struct {
	repo deviceRepo.DeviceRepository
}

// NewListDevicesUseCase constructs a ListDevicesUseCase.
func NewListDevicesUseCase(repo deviceRepo.DeviceRepository) *ListDevicesUseCase {
	return &ListDevicesUseCase{repo: repo}
}

// Execute returns all registered devices for the given user ID.
func (uc *ListDevicesUseCase) Execute(ctx context.Context, userID uuid.UUID) ([]*dto.DeviceResponse, error) {
	devices, err := uc.repo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("listDevices: %w", err)
	}

	result := make([]*dto.DeviceResponse, 0, len(devices))
	for _, d := range devices {
		result = append(result, &dto.DeviceResponse{
			ID:         d.ID.String(),
			UserID:     d.UserID.String(),
			DeviceID:   d.DeviceID,
			Platform:   d.Platform,
			DeviceName: d.DeviceName,
			Model:      d.Model,
			Brand:      d.Brand,
			OSName:     d.OSName,
			OSVersion:  d.OSVersion,
			AppName:    d.AppName,
			AppVersion: d.AppVersion,
			AppBuild:   d.AppBuild,
			CreatedAt:  d.CreatedAt.Format(time.RFC3339),
			UpdatedAt:  d.UpdatedAt.Format(time.RFC3339),
		})
	}

	return result, nil
}
