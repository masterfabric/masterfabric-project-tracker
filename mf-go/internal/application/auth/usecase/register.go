package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/auth/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/event"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/model"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	infraAuth "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/auth"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/events"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/validation"
)

// RegisterUseCase creates a new user account and returns an auth token pair.
type RegisterUseCase struct {
	userRepo repository.UserRepository
	jwtSvc   *infraAuth.JWTService
	eventBus events.EventBus
}

// NewRegisterUseCase constructs a RegisterUseCase.
func NewRegisterUseCase(
	userRepo repository.UserRepository,
	jwtSvc *infraAuth.JWTService,
	eventBus events.EventBus,
) *RegisterUseCase {
	return &RegisterUseCase{userRepo: userRepo, jwtSvc: jwtSvc, eventBus: eventBus}
}

// Execute registers a new user.
func (uc *RegisterUseCase) Execute(ctx context.Context, req *dto.RegisterRequest) (*dto.AuthResponse, error) {
	if err := validation.Struct(req); err != nil {
		return nil, err
	}

	// Check email uniqueness
	existing, err := uc.userRepo.FindByEmail(ctx, req.Email)
	if err == nil && existing != nil {
		return nil, domainErr.ErrEmailTaken
	}

	// Hash password
	hash, err := infraAuth.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("register: hash password: %w", err)
	}

	// Build user entity
	now := time.Now().UTC()
	user := &model.User{
		ID:           uuid.New(),
		Email:        req.Email,
		PasswordHash: hash,
		DisplayName:  req.DisplayName,
		Status:       model.UserStatusActive,
		Role:         model.DefaultRole,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := uc.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("register: create user: %w", err)
	}

	// Generate tokens
	pair, err := uc.jwtSvc.GenerateTokenPair(ctx, user.ID, user.Email, string(user.Role))
	if err != nil {
		return nil, fmt.Errorf("register: generate tokens: %w", err)
	}

	// Publish domain event (best-effort)
	_ = uc.eventBus.Publish(ctx, events.TopicUserRegistered, events.Event{
		Type: event.EventUserRegistered,
		Payload: event.UserRegisteredPayload{
			UserID:    user.ID.String(),
			Email:     user.Email,
			CreatedAt: user.CreatedAt,
		},
	})

	return &dto.AuthResponse{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresIn:    pair.ExpiresIn,
		User: dto.UserData{
			ID:          user.ID.String(),
			Email:       user.Email,
			DisplayName: user.DisplayName,
			AvatarURL:   user.AvatarURL,
			Role:        string(user.Role),
		},
	}, nil
}
