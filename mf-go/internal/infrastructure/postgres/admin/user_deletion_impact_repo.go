package admin

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/admin/dto"
)

// UserDeletionImpactRepo loads aggregate counts for admin "what will be deleted" preview.
type UserDeletionImpactRepo struct {
	db *pgxpool.Pool
}

// NewUserDeletionImpactRepo constructs UserDeletionImpactRepo.
func NewUserDeletionImpactRepo(db *pgxpool.Pool) *UserDeletionImpactRepo {
	return &UserDeletionImpactRepo{db: db}
}

// FetchCounts returns relational counts for the given user (user row must exist).
func (r *UserDeletionImpactRepo) FetchCounts(ctx context.Context, userID uuid.UUID) (*dto.UserDeletionImpactResponse, error) {
	out := &dto.UserDeletionImpactResponse{UserID: userID}

	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM user_todos WHERE user_id = $1`, userID).Scan(&out.OwnedTodoCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact owned todos: %w", err)
	}
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM user_todos WHERE assigned_to_user_id = $1 AND user_id <> $1`,
		userID,
	).Scan(&out.TodoAssigneeClearCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact assignee todos: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM organization_members WHERE user_id = $1`, userID).Scan(&out.OrganizationMembershipCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact org members: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM user_addresses WHERE user_id = $1`, userID).Scan(&out.AddressCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact addresses: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM user_devices WHERE user_id = $1`, userID).Scan(&out.DeviceCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact devices: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM user_settings WHERE user_id = $1)`, userID).Scan(&out.HasUserSettings); err != nil {
		return nil, fmt.Errorf("userDeletionImpact settings: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM notification_reads WHERE user_id = $1`, userID).Scan(&out.NotificationReadCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact notification reads: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM user_sessions WHERE user_id = $1`, userID).Scan(&out.SessionCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact sessions: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM user_messages WHERE user_id = $1`, userID).Scan(&out.UserMessageCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact messages: %w", err)
	}
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM organization_invitations WHERE inviter_id = $1 AND status = 'pending'`,
		userID,
	).Scan(&out.PendingInvitationAsInviterCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact invitations: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM organization_messages WHERE author_user_id = $1`, userID).Scan(&out.OrganizationMessageAuthoredCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact org messages: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM organization_news WHERE author_user_id = $1`, userID).Scan(&out.OrganizationNewsAuthoredCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact org news: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM otp_codes WHERE user_id = $1`, userID).Scan(&out.OtpCodeHistoryCount); err != nil {
		return nil, fmt.Errorf("userDeletionImpact otp codes: %w", err)
	}

	rows, err := r.db.Query(ctx, `
		SELECT o.id, o.name,
		       GREATEST((SELECT COUNT(*)::int FROM organization_members om WHERE om.organization_id = o.id) - 1, 0)
		FROM organizations o
		WHERE o.owner_user_id = $1
		ORDER BY o.name
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("userDeletionImpact owned orgs: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var item dto.OwnedOrganizationDeletionImpact
		if err := rows.Scan(&item.OrganizationID, &item.Name, &item.OtherMemberCount); err != nil {
			return nil, fmt.Errorf("userDeletionImpact owned org scan: %w", err)
		}
		out.OwnedOrganizations = append(out.OwnedOrganizations, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("userDeletionImpact owned org rows: %w", err)
	}

	return out, nil
}
