package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/session"
)

// ListUserSessionsUseCase returns active user sessions for admin visibility.
type ListUserSessionsUseCase struct {
	sessionRepo *session.SessionRepo
}

// NewListUserSessionsUseCase constructs a ListUserSessionsUseCase.
func NewListUserSessionsUseCase(sessionRepo *session.SessionRepo) *ListUserSessionsUseCase {
	return &ListUserSessionsUseCase{sessionRepo: sessionRepo}
}

// SessionResponse is the DTO for a user session.
type SessionResponse struct {
	ID                string
	UserID            string
	UserEmail         string
	UserDisplayName   string
	OrganizationNames []string
	DeviceID          string
	Platform          string
	DeviceName        string
	CreatedAt         string
	LastRefreshedAt   string
}

// Execute returns sessions for a user (or all if userID is nil). Requires admin role.
func (uc *ListUserSessionsUseCase) Execute(ctx context.Context, userID *uuid.UUID, limit int) ([]*SessionResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}

	var rows []*session.SessionRowWithUser
	var err error

	if userID != nil {
		rows, err = uc.sessionRepo.ListByUserIDWithUserInfo(ctx, *userID)
	} else {
		rows, err = uc.sessionRepo.ListAllWithUserInfo(ctx, limit)
	}
	if err != nil {
		return nil, err
	}

	out := make([]*SessionResponse, 0, len(rows))
	for _, r := range rows {
		orgNames := r.OrganizationNames
		if orgNames == nil {
			orgNames = []string{}
		}
		out = append(out, &SessionResponse{
			ID:                r.ID.String(),
			UserID:            r.UserID.String(),
			UserEmail:         r.UserEmail,
			UserDisplayName:   r.UserDisplayName,
			OrganizationNames: orgNames,
			DeviceID:          r.DeviceID,
			Platform:          r.Platform,
			DeviceName:        r.DeviceName,
			CreatedAt:         r.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			LastRefreshedAt:   r.LastRefreshedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	return out, nil
}
