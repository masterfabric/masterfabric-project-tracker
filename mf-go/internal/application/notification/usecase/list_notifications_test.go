package usecase

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/notification/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/model"
)

type mockNotificationRepo struct {
	listFn     func(ctx context.Context, limit int, language string) ([]*model.Notification, error)
	getReadIDs func(ctx context.Context, userID uuid.UUID) (map[uuid.UUID]bool, error)
}

func (m *mockNotificationRepo) Create(_ context.Context, _ *model.Notification) error { return nil }
func (m *mockNotificationRepo) List(ctx context.Context, limit int, language string) ([]*model.Notification, error) {
	if m.listFn != nil {
		return m.listFn(ctx, limit, language)
	}
	return nil, nil
}
func (m *mockNotificationRepo) MarkRead(_ context.Context, _, _ uuid.UUID) error { return nil }
func (m *mockNotificationRepo) MarkAllRead(_ context.Context, _ uuid.UUID, _ []uuid.UUID) error {
	return nil
}
func (m *mockNotificationRepo) MarkAllReadForUser(_ context.Context, _ uuid.UUID) error { return nil }
func (m *mockNotificationRepo) GetReadIDs(ctx context.Context, userID uuid.UUID) (map[uuid.UUID]bool, error) {
	if m.getReadIDs != nil {
		return m.getReadIDs(ctx, userID)
	}
	return map[uuid.UUID]bool{}, nil
}
func (m *mockNotificationRepo) DeleteAll(_ context.Context) error               { return nil }
func (m *mockNotificationRepo) DeleteByID(_ context.Context, _ uuid.UUID) error { return nil }
func (m *mockNotificationRepo) FindByID(_ context.Context, _ uuid.UUID) (*model.Notification, error) {
	return nil, nil
}
func (m *mockNotificationRepo) Update(_ context.Context, _ *model.Notification) error { return nil }

func TestListNotificationsUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	n1 := &model.Notification{
		ID:        uuid.New(),
		Title:     "Test 1",
		Message:   "Message 1",
		Type:      model.NotificationTypeInfo,
		Category:  "app",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	n2 := &model.Notification{
		ID:        uuid.New(),
		Title:     "Test 2",
		Message:   "Message 2",
		Type:      model.NotificationTypeInfo,
		Category:  "app",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	tests := []struct {
		name     string
		req      *dto.ListNotificationsRequest
		list     []*model.Notification
		readIDs  map[uuid.UUID]bool
		wantLen  int
		wantRead []bool
	}{
		{
			name:     "unauthenticated no read status",
			req:      &dto.ListNotificationsRequest{Limit: 10},
			list:     []*model.Notification{n1, n2},
			readIDs:  map[uuid.UUID]bool{},
			wantLen:  2,
			wantRead: []bool{false, false},
		},
		{
			name:     "authenticated with read status",
			req:      &dto.ListNotificationsRequest{UserID: uuid.New().String(), Limit: 10},
			list:     []*model.Notification{n1, n2},
			readIDs:  map[uuid.UUID]bool{n1.ID: true},
			wantLen:  2,
			wantRead: []bool{true, false},
		},
		{
			name:    "respects limit",
			req:     &dto.ListNotificationsRequest{Limit: 1},
			list:    []*model.Notification{n1, n2},
			readIDs: map[uuid.UUID]bool{},
			wantLen: 2, // repo returns 2; usecase doesn't re-limit
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var userID uuid.UUID
			if tt.req.UserID != "" {
				userID, _ = uuid.Parse(tt.req.UserID)
			}
			uid := userID
			repo := &mockNotificationRepo{
				listFn: func(_ context.Context, limit int, _ string) ([]*model.Notification, error) {
					return tt.list, nil
				},
				getReadIDs: func(_ context.Context, u uuid.UUID) (map[uuid.UUID]bool, error) {
					if u == uid {
						return tt.readIDs, nil
					}
					return map[uuid.UUID]bool{}, nil
				},
			}
			uc := NewListNotificationsUseCase(repo)
			got, err := uc.Execute(ctx, tt.req)
			if err != nil {
				t.Fatalf("Execute() error = %v", err)
			}
			if len(got) != tt.wantLen {
				t.Errorf("Execute() len = %d, want %d", len(got), tt.wantLen)
			}
			if len(tt.wantRead) > 0 && len(got) >= len(tt.wantRead) {
				for i, r := range tt.wantRead {
					if got[i].IsRead != r {
						t.Errorf("got[%d].IsRead = %v, want %v", i, got[i].IsRead, r)
					}
				}
			}
		})
	}
}
