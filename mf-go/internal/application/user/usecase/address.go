package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/user/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// ── GetAddressUseCase ──────────────────────────────────────────────────────────

// GetAddressUseCase returns all addresses for the given user ID.
type GetAddressUseCase struct {
	userRepo repository.UserRepository
}

// NewGetAddressUseCase constructs a GetAddressUseCase.
func NewGetAddressUseCase(userRepo repository.UserRepository) *GetAddressUseCase {
	return &GetAddressUseCase{userRepo: userRepo}
}

// Execute returns all addresses owned by the user.
func (uc *GetAddressUseCase) Execute(ctx context.Context, userID string) ([]*dto.AddressResponse, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domainErr.ErrUserNotFound
	}

	addrs, err := uc.userRepo.FindAddressByUserID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("getAddress: %w", err)
	}

	resp := make([]*dto.AddressResponse, 0, len(addrs))
	for _, a := range addrs {
		resp = append(resp, addressToResponse(a))
	}
	return resp, nil
}

// GetDefaultAddressUseCase returns the single default address for a user (nil if none).
type GetDefaultAddressUseCase struct {
	userRepo repository.UserRepository
}

// NewGetDefaultAddressUseCase constructs a GetDefaultAddressUseCase.
func NewGetDefaultAddressUseCase(userRepo repository.UserRepository) *GetDefaultAddressUseCase {
	return &GetDefaultAddressUseCase{userRepo: userRepo}
}

// Execute returns the default address or nil if the user has not set one.
func (uc *GetDefaultAddressUseCase) Execute(ctx context.Context, userID string) (*dto.AddressResponse, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domainErr.ErrUserNotFound
	}

	addr, err := uc.userRepo.FindDefaultAddressByUserID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("getDefaultAddress: %w", err)
	}
	if addr == nil {
		return nil, nil
	}
	return addressToResponse(addr), nil
}

// ── UpsertAddressUseCase ───────────────────────────────────────────────────────

// UpsertAddressUseCase creates a new address or updates an existing one.
type UpsertAddressUseCase struct {
	userRepo repository.UserRepository
}

// NewUpsertAddressUseCase constructs an UpsertAddressUseCase.
func NewUpsertAddressUseCase(userRepo repository.UserRepository) *UpsertAddressUseCase {
	return &UpsertAddressUseCase{userRepo: userRepo}
}

// Execute persists the address and returns the saved row.
func (uc *UpsertAddressUseCase) Execute(ctx context.Context, req *dto.UpsertAddressRequest) (*dto.AddressResponse, error) {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, domainErr.ErrUserNotFound
	}

	// Determine the address ID: use the provided one or generate a new UUID.
	var addrID uuid.UUID
	if req.AddressID != nil && *req.AddressID != "" {
		addrID, err = uuid.Parse(*req.AddressID)
		if err != nil {
			return nil, domainErr.New("VALIDATION_ERROR", "invalid address ID", nil)
		}
	} else {
		addrID = uuid.New()
	}

	addr := &model.UserAddress{
		ID:        addrID,
		UserID:    userID,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	// Apply provided fields (all optional)
	if req.Title != nil {
		addr.Title = *req.Title
	}
	if req.AddressLine1 != nil {
		addr.AddressLine1 = *req.AddressLine1
	}
	if req.AddressLine2 != nil {
		addr.AddressLine2 = *req.AddressLine2
	}
	if req.City != nil {
		addr.City = *req.City
	}
	if req.State != nil {
		addr.State = *req.State
	}
	if req.PostalCode != nil {
		addr.PostalCode = *req.PostalCode
	}
	if req.Country != nil {
		addr.Country = *req.Country
	}
	if req.IsDefault != nil {
		addr.IsDefault = *req.IsDefault
	}

	saved, err := uc.userRepo.UpsertAddress(ctx, addr)
	if err != nil {
		return nil, fmt.Errorf("upsertAddress: %w", err)
	}
	return addressToResponse(saved), nil
}

// ── helpers ────────────────────────────────────────────────────────────────────

func addressToResponse(a *model.UserAddress) *dto.AddressResponse {
	return &dto.AddressResponse{
		ID:           a.ID.String(),
		UserID:       a.UserID.String(),
		Title:        a.Title,
		AddressLine1: a.AddressLine1,
		AddressLine2: a.AddressLine2,
		City:         a.City,
		State:        a.State,
		PostalCode:   a.PostalCode,
		Country:      a.Country,
		IsDefault:    a.IsDefault,
		CreatedAt:    a.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    a.UpdatedAt.Format(time.RFC3339),
	}
}
