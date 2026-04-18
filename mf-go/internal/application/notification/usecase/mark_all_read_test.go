package usecase

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

func TestMarkAllNotificationsReadUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := &mockNotificationRepo{}
		uc := NewMarkAllNotificationsReadUseCase(repo)
		err := uc.Execute(ctx, &MarkAllNotificationsReadRequest{UserID: userID.String()})
		if err != nil {
			t.Errorf("Execute() error = %v, want nil", err)
		}
	})

	t.Run("invalid user id", func(t *testing.T) {
		repo := &mockNotificationRepo{}
		uc := NewMarkAllNotificationsReadUseCase(repo)
		err := uc.Execute(ctx, &MarkAllNotificationsReadRequest{UserID: "invalid"})
		if err == nil {
			t.Error("Execute() error = nil, want error for invalid user id")
		}
	})
}
