package usecase

import (
	"context"

	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/policy"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/postgres/session"
)

// GetSessionStatsUseCase returns session stats for admin dashboard.
type GetSessionStatsUseCase struct {
	sessionRepo *session.SessionRepo
}

// NewGetSessionStatsUseCase constructs a GetSessionStatsUseCase.
func NewGetSessionStatsUseCase(sessionRepo *session.SessionRepo) *GetSessionStatsUseCase {
	return &GetSessionStatsUseCase{sessionRepo: sessionRepo}
}

// SessionStatsResponse is the DTO for session stats.
type SessionStatsResponse struct {
	TotalActiveSessions    int
	UniqueActiveUsers      int
	TotalUsers             int
	TotalRegisteredDevices int
}

// Execute returns session stats. Requires admin role.
func (uc *GetSessionStatsUseCase) Execute(ctx context.Context) (*SessionStatsResponse, error) {
	if err := policy.RequireAdmin(ctx); err != nil {
		return nil, err
	}
	stats, err := uc.sessionRepo.GetSessionStats(ctx)
	if err != nil {
		return nil, err
	}
	return &SessionStatsResponse{
		TotalActiveSessions:    stats.TotalActiveSessions,
		UniqueActiveUsers:      stats.UniqueActiveUsers,
		TotalUsers:             stats.TotalUsers,
		TotalRegisteredDevices: stats.TotalRegisteredDevices,
	}, nil
}
