package session

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SessionRepo upserts and lists user sessions for admin visibility.
type SessionRepo struct {
	db *pgxpool.Pool
}

// NewSessionRepo creates a new SessionRepo.
func NewSessionRepo(db *pgxpool.Pool) *SessionRepo {
	return &SessionRepo{db: db}
}

// UpsertSession creates or updates a session (by user_id + device_id).
func (r *SessionRepo) UpsertSession(ctx context.Context, userID uuid.UUID, deviceID, platform, deviceName string) error {
	now := time.Now().UTC()
	_, err := r.db.Exec(ctx, `
		INSERT INTO user_sessions (user_id, device_id, platform, device_name, created_at, last_refreshed_at)
		VALUES ($1, $2, $3, $4, $5, $5)
		ON CONFLICT (user_id, device_id) DO UPDATE
		SET platform = EXCLUDED.platform, device_name = EXCLUDED.device_name, last_refreshed_at = EXCLUDED.last_refreshed_at`,
		userID, deviceID, platform, deviceName, now,
	)
	if err != nil {
		return fmt.Errorf("sessionRepo.UpsertSession: %w", err)
	}
	return nil
}

// SessionRow is a row from user_sessions for admin display.
type SessionRow struct {
	ID              uuid.UUID
	UserID          uuid.UUID
	DeviceID        string
	Platform        string
	DeviceName      string
	CreatedAt       time.Time
	LastRefreshedAt time.Time
}

// SessionRowWithUser extends SessionRow with user and org info.
type SessionRowWithUser struct {
	SessionRow
	UserEmail         string
	UserDisplayName   string
	OrganizationNames []string
}

// SessionStats holds aggregate counts for admin dashboard.
type SessionStats struct {
	TotalActiveSessions    int
	UniqueActiveUsers      int
	TotalUsers             int
	TotalRegisteredDevices int
}

// ListByUserID returns sessions for a user (for admin viewing a specific user).
func (r *SessionRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*SessionRow, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, device_id, platform, device_name, created_at, last_refreshed_at
		FROM user_sessions
		WHERE user_id = $1
		ORDER BY last_refreshed_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("sessionRepo.ListByUserID: %w", err)
	}
	defer rows.Close()

	var out []*SessionRow
	for rows.Next() {
		var s SessionRow
		if err := rows.Scan(&s.ID, &s.UserID, &s.DeviceID, &s.Platform, &s.DeviceName, &s.CreatedAt, &s.LastRefreshedAt); err != nil {
			return nil, fmt.Errorf("sessionRepo.ListByUserID scan: %w", err)
		}
		out = append(out, &s)
	}
	return out, nil
}

const sqlListAllWithUserInfo = `
	SELECT us.id, us.user_id, us.device_id, us.platform, us.device_name, us.created_at, us.last_refreshed_at,
	       u.email, u.display_name,
	       COALESCE(
	         (SELECT string_agg(o.name, ', ' ORDER BY o.name)
	          FROM organization_members om
	          JOIN organizations o ON o.id = om.organization_id
	          WHERE om.user_id = us.user_id),
	         ''
	       ) AS org_names
	FROM user_sessions us
	JOIN users u ON u.id = us.user_id
	ORDER BY us.last_refreshed_at DESC
	LIMIT $1`

const sqlListByUserIDWithUserInfo = `
	SELECT us.id, us.user_id, us.device_id, us.platform, us.device_name, us.created_at, us.last_refreshed_at,
	       u.email, u.display_name,
	       COALESCE(
	         (SELECT string_agg(o.name, ', ' ORDER BY o.name)
	          FROM organization_members om
	          JOIN organizations o ON o.id = om.organization_id
	          WHERE om.user_id = us.user_id),
	         ''
	       ) AS org_names
	FROM user_sessions us
	JOIN users u ON u.id = us.user_id
	WHERE us.user_id = $1
	ORDER BY us.last_refreshed_at DESC`

// ListAll returns all sessions (for admin dashboard).
func (r *SessionRepo) ListAll(ctx context.Context, limit int) ([]*SessionRow, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, device_id, platform, device_name, created_at, last_refreshed_at
		FROM user_sessions
		ORDER BY last_refreshed_at DESC
		LIMIT $1`,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("sessionRepo.ListAll: %w", err)
	}
	defer rows.Close()

	var out []*SessionRow
	for rows.Next() {
		var s SessionRow
		if err := rows.Scan(&s.ID, &s.UserID, &s.DeviceID, &s.Platform, &s.DeviceName, &s.CreatedAt, &s.LastRefreshedAt); err != nil {
			return nil, fmt.Errorf("sessionRepo.ListAll scan: %w", err)
		}
		out = append(out, &s)
	}
	return out, nil
}

// ListAllWithUserInfo returns all sessions with user email, display name, and org names.
func (r *SessionRepo) ListAllWithUserInfo(ctx context.Context, limit int) ([]*SessionRowWithUser, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.db.Query(ctx, sqlListAllWithUserInfo, limit)
	if err != nil {
		return nil, fmt.Errorf("sessionRepo.ListAllWithUserInfo: %w", err)
	}
	defer rows.Close()

	var out []*SessionRowWithUser
	for rows.Next() {
		var s SessionRowWithUser
		var orgNamesStr string
		if err := rows.Scan(&s.ID, &s.UserID, &s.DeviceID, &s.Platform, &s.DeviceName, &s.CreatedAt, &s.LastRefreshedAt,
			&s.UserEmail, &s.UserDisplayName, &orgNamesStr); err != nil {
			return nil, fmt.Errorf("sessionRepo.ListAllWithUserInfo scan: %w", err)
		}
		if orgNamesStr != "" {
			s.OrganizationNames = strings.Split(orgNamesStr, ", ")
		} else {
			s.OrganizationNames = []string{}
		}
		out = append(out, &s)
	}
	return out, nil
}

// ListByUserIDWithUserInfo returns sessions for a user with user and org info.
func (r *SessionRepo) ListByUserIDWithUserInfo(ctx context.Context, userID uuid.UUID) ([]*SessionRowWithUser, error) {
	rows, err := r.db.Query(ctx, sqlListByUserIDWithUserInfo, userID)
	if err != nil {
		return nil, fmt.Errorf("sessionRepo.ListByUserIDWithUserInfo: %w", err)
	}
	defer rows.Close()

	var out []*SessionRowWithUser
	for rows.Next() {
		var s SessionRowWithUser
		var orgNamesStr string
		if err := rows.Scan(&s.ID, &s.UserID, &s.DeviceID, &s.Platform, &s.DeviceName, &s.CreatedAt, &s.LastRefreshedAt,
			&s.UserEmail, &s.UserDisplayName, &orgNamesStr); err != nil {
			return nil, fmt.Errorf("sessionRepo.ListByUserIDWithUserInfo scan: %w", err)
		}
		if orgNamesStr != "" {
			s.OrganizationNames = strings.Split(orgNamesStr, ", ")
		} else {
			s.OrganizationNames = []string{}
		}
		out = append(out, &s)
	}
	return out, nil
}

// DeleteAllForUser removes session rows for a user (e.g. admin forced logout).
func (r *SessionRepo) DeleteAllForUser(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM user_sessions WHERE user_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("sessionRepo.DeleteAllForUser: %w", err)
	}
	return nil
}

// GetSessionStats returns aggregate counts for admin dashboard.
func (r *SessionRepo) GetSessionStats(ctx context.Context) (*SessionStats, error) {
	var stats SessionStats
	err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM user_sessions) AS total_sessions,
			(SELECT COUNT(DISTINCT user_id) FROM user_sessions) AS unique_active_users,
			(SELECT COUNT(*) FROM users) AS total_users,
			(SELECT COUNT(*) FROM user_devices) AS total_devices
	`).Scan(&stats.TotalActiveSessions, &stats.UniqueActiveUsers, &stats.TotalUsers, &stats.TotalRegisteredDevices)
	if err != nil {
		return nil, fmt.Errorf("sessionRepo.GetSessionStats: %w", err)
	}
	return &stats, nil
}
