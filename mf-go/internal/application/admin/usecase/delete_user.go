package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/event"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/events"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/middleware"
)

// DeleteUserUseCase permanently deletes a user (admin only). Caller cannot delete themselves.
type DeleteUserUseCase struct {
	userRepo repository.UserRepository
	eventBus events.EventBus
}

func NewDeleteUserUseCase(userRepo repository.UserRepository, bus events.EventBus) *DeleteUserUseCase {
	return &DeleteUserUseCase{userRepo: userRepo, eventBus: bus}
}

func (uc *DeleteUserUseCase) Execute(ctx context.Context, targetID uuid.UUID) error {
	if err := policy.RequireAdmin(ctx); err != nil {
		return err
	}
	callerID := middleware.UserIDFromContext(ctx)
	if callerID == targetID {
		return domainErr.New("ADMIN_CANNOT_DELETE_SELF", "admins cannot delete their own account", nil)
	}
	if err := uc.userRepo.Delete(ctx, targetID); err != nil {
		return fmt.Errorf("adminDeleteUser: %w", err)
	}

	_ = uc.eventBus.Publish(ctx, events.TopicUserDeleted, events.Event{
		Type:    event.EventUserDeleted,
		Payload: map[string]string{"user_id": targetID.String()},
	})
	return nil
}
