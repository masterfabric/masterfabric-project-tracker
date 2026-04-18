package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// DeleteAddressUseCase removes a saved address for a user.
type DeleteAddressUseCase struct {
	userRepo repository.UserRepository
}

// NewDeleteAddressUseCase constructs a DeleteAddressUseCase.
func NewDeleteAddressUseCase(userRepo repository.UserRepository) *DeleteAddressUseCase {
	return &DeleteAddressUseCase{userRepo: userRepo}
}

// Execute deletes the address id for userID.
func (uc *DeleteAddressUseCase) Execute(ctx context.Context, userID, addressID string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return domainErr.New("VALIDATION_ERROR", "invalid user id", err)
	}
	aid, err := uuid.Parse(addressID)
	if err != nil {
		return domainErr.New("VALIDATION_ERROR", "invalid address id", err)
	}
	return uc.userRepo.DeleteAddress(ctx, uid, aid)
}
