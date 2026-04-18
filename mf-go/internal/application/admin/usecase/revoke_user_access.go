package usecase

import (
	"context"

	"github.com/google/uuid"
	msgdto "github.com/masterfabric/masterfabric_go_basic/internal/application/usermessage/dto"
	usermessageUC "github.com/masterfabric/masterfabric_go_basic/internal/application/usermessage/usecase"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/model"
	infraAuth "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/auth"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/session"
)

const (
	userMsgInactiveBody   = "Your account has been set to inactive by an administrator. You have been signed out on all devices."
	userMsgSuspendedBody  = "Your account has been suspended by an administrator. You have been signed out on all devices."
	userMsgDeactivateType = "warning"
)

// RevokeUserAccessCoordinator forces logout across devices when admin deactivates a user.
type RevokeUserAccessCoordinator struct {
	jwtSvc      *infraAuth.JWTService
	sessionRepo *session.SessionRepo
	msgUC       *usermessageUC.AdminCreateUserMessageUseCase
}

// NewRevokeUserAccessCoordinator wires JWT revocation, DB session cleanup, and optional user message.
func NewRevokeUserAccessCoordinator(
	jwtSvc *infraAuth.JWTService,
	sessionRepo *session.SessionRepo,
	msgUC *usermessageUC.AdminCreateUserMessageUseCase,
) *RevokeUserAccessCoordinator {
	return &RevokeUserAccessCoordinator{
		jwtSvc:      jwtSvc,
		sessionRepo: sessionRepo,
		msgUC:       msgUC,
	}
}

// RevokeAllSessionsAndNotify marks tokens invalid, deletes refresh keys + user_sessions, sends in-app message.
func (c *RevokeUserAccessCoordinator) RevokeAllSessionsAndNotify(ctx context.Context, targetUserID uuid.UUID, message string) error {
	_ = c.jwtSvc.MarkUserAccessRevoked(ctx, targetUserID)
	_ = c.jwtSvc.DeleteAllRefreshTokensForUser(ctx, targetUserID)
	if c.sessionRepo != nil {
		_ = c.sessionRepo.DeleteAllForUser(ctx, targetUserID)
	}
	if c.msgUC != nil && message != "" {
		_, _ = c.msgUC.Execute(ctx, &msgdto.CreateUserMessageRequest{
			UserID:  targetUserID.String(),
			Message: message,
			Type:    userMsgDeactivateType,
		})
	}
	return nil
}

// ClearRevocation removes the access-token revocation marker when the account is active again.
func (c *RevokeUserAccessCoordinator) ClearRevocation(ctx context.Context, targetUserID uuid.UUID) error {
	return c.jwtSvc.ClearUserAccessRevoked(ctx, targetUserID)
}

// MessageForStatus returns the user-facing snackbar body for the given non-active status.
func MessageForStatus(st model.UserStatus) string {
	switch st {
	case model.UserStatusSuspended:
		return userMsgSuspendedBody
	case model.UserStatusInactive:
		return userMsgInactiveBody
	default:
		return ""
	}
}
