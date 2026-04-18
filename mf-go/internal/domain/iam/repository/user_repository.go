package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/model"
)

// UserRepository defines persistence operations for User entities.
// Infrastructure must implement this interface; domain does not depend on infrastructure.
type UserRepository interface {
	Create(ctx context.Context, user *model.User) error
	FindByID(ctx context.Context, id uuid.UUID) (*model.User, error)
	FindByEmail(ctx context.Context, email string) (*model.User, error)
	Update(ctx context.Context, user *model.User) error
	Delete(ctx context.Context, id uuid.UUID) error
	// Nickname availability (case-insensitive). excludeUserID nil = check all users.
	NicknameExists(ctx context.Context, nickname string, excludeUserID *uuid.UUID) (bool, error)
	// Admin operations
	List(ctx context.Context, limit, offset int) ([]*model.User, error)
	CountAll(ctx context.Context) (int, error)
	// Address operations
	CreateAddress(ctx context.Context, addr *model.UserAddress) error
	UpsertAddress(ctx context.Context, addr *model.UserAddress) (*model.UserAddress, error)
	FindAddressByUserID(ctx context.Context, userID uuid.UUID) ([]*model.UserAddress, error)
	FindDefaultAddressByUserID(ctx context.Context, userID uuid.UUID) (*model.UserAddress, error)
	// DeleteAddress removes one address row; must match userID (no-op → ErrAddressNotFound).
	DeleteAddress(ctx context.Context, userID, addressID uuid.UUID) error
}
