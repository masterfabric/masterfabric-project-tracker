package organization

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
)

// OrganizationRepo is the PostgreSQL implementation of domain OrganizationRepository.
type OrganizationRepo struct {
	db *pgxpool.Pool
}

// NewOrganizationRepo creates a new OrganizationRepo.
func NewOrganizationRepo(db *pgxpool.Pool) *OrganizationRepo {
	return &OrganizationRepo{db: db}
}

const (
	sqlCreateOrg = `
		INSERT INTO organizations (id, name, description, logo_url, website_url, contact_email, owner_user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	sqlUpdateOrg = `
		UPDATE organizations
		SET name = $2, description = $3, logo_url = $4, website_url = $5, contact_email = $6, updated_at = $7
		WHERE id = $1`

	sqlAddMember = `
		INSERT INTO organization_members (id, organization_id, user_id, role, membership_status, joined_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (organization_id, user_id) DO NOTHING`

	sqlCreateInvitation = `
		INSERT INTO organization_invitations (id, organization_id, inviter_id, invitee_email, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (organization_id, invitee_email) DO UPDATE
		    SET status = 'pending', inviter_id = EXCLUDED.inviter_id
		RETURNING id, organization_id, inviter_id, invitee_email, status, created_at`

	sqlGetOrgByID = `
		SELECT id, name, description, logo_url, website_url, contact_email, owner_user_id, created_at, updated_at
		FROM organizations WHERE id = $1`

	sqlListOrgsByUserID = `
		SELECT o.id, o.name, o.description, o.logo_url, o.website_url, o.contact_email, o.owner_user_id, o.created_at, o.updated_at
		FROM organizations o
		INNER JOIN organization_members m ON m.organization_id = o.id
		WHERE m.user_id = $1 AND m.membership_status = 'active'
		ORDER BY o.created_at DESC`

	sqlListMembers = `
		SELECT id, organization_id, user_id, role, membership_status, joined_at
		FROM organization_members
		WHERE organization_id = $1
		ORDER BY joined_at ASC`

	sqlListPendingInvitationsByEmail = `
		SELECT i.id, i.organization_id, i.inviter_id, i.invitee_email, i.status, i.created_at,
		       o.name,
		       COALESCE(NULLIF(TRIM(u.nickname), ''), NULLIF(TRIM(u.display_name), ''), '')
		FROM organization_invitations i
		INNER JOIN organizations o ON o.id = i.organization_id
		LEFT JOIN users u ON u.id = i.inviter_id
		WHERE LOWER(i.invitee_email) = LOWER($1) AND i.status = 'pending'
		ORDER BY i.created_at DESC`

	sqlListInvitationsByOrganizationID = `
		SELECT id, organization_id, inviter_id, invitee_email, status, created_at
		FROM organization_invitations
		WHERE organization_id = $1
		ORDER BY created_at DESC`

	sqlGetInvitationByID = `
		SELECT id, organization_id, inviter_id, invitee_email, status, created_at FROM organization_invitations WHERE id = $1`

	sqlIsMember = `
		SELECT 1 FROM organization_members
		WHERE organization_id = $1 AND user_id = $2 AND membership_status = 'active'
		LIMIT 1`

	sqlIsAdminOrOwner = `
		SELECT 1 FROM organization_members
		WHERE organization_id = $1 AND user_id = $2 AND role IN ('owner', 'admin') AND membership_status = 'active'
		LIMIT 1`

	sqlGetMember = `
		SELECT id, organization_id, user_id, role, membership_status, joined_at
		FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
		LIMIT 1`

	sqlRemoveMember = `
		DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`

	sqlSetMemberMembershipStatus = `
		UPDATE organization_members SET membership_status = $3 WHERE organization_id = $1 AND user_id = $2`

	sqlUpdateInvitationStatus = `
		UPDATE organization_invitations SET status = $2 WHERE id = $1`

	sqlResendPendingInvitation = `
		UPDATE organization_invitations
		SET inviter_id = $3, created_at = $4
		WHERE id = $1 AND organization_id = $2 AND status = 'pending'
		RETURNING id, organization_id, inviter_id, invitee_email, status, created_at`

	sqlListNews = `
		SELECT id, organization_id, author_user_id, title, description, image_url, rich_metadata, created_at, updated_at
		FROM organization_news
		WHERE organization_id = $1
		  AND ($2::timestamptz IS NULL OR created_at < $2)
		ORDER BY created_at DESC
		LIMIT $3`

	sqlGetNewsByID = `
		SELECT id, organization_id, author_user_id, title, description, image_url, rich_metadata, created_at, updated_at
		FROM organization_news WHERE id = $1`

	sqlInsertNews = `
		INSERT INTO organization_news (id, organization_id, author_user_id, title, description, image_url, rich_metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	sqlUpdateNews = `
		UPDATE organization_news
		SET title = $2, description = $3, image_url = $4, rich_metadata = $5, updated_at = $6
		WHERE id = $1`

	sqlDeleteNews = `DELETE FROM organization_news WHERE id = $1`

	sqlListMessages = `
		SELECT id, organization_id, author_user_id, body, created_at
		FROM organization_messages
		WHERE organization_id = $1
		  AND ($2::timestamptz IS NULL OR created_at < $2)
		ORDER BY created_at DESC
		LIMIT $3`

	sqlInsertMessage = `
		INSERT INTO organization_messages (id, organization_id, author_user_id, body, created_at)
		VALUES ($1, $2, $3, $4, $5)`

	sqlGetMessageByID = `
		SELECT id, organization_id, author_user_id, body, created_at
		FROM organization_messages WHERE id = $1`

	sqlDeleteMessage = `
		DELETE FROM organization_messages WHERE id = $1 AND organization_id = $2`
)

// Create inserts a new organization.
func (r *OrganizationRepo) Create(ctx context.Context, org *model.Organization) error {
	_, err := r.db.Exec(ctx, sqlCreateOrg,
		org.ID, org.Name, org.Description, org.LogoURL, org.WebsiteURL, org.ContactEmail,
		org.OwnerUserID, org.CreatedAt, org.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("organizationRepo.Create: %w", err)
	}
	return nil
}

// UpdateOrganization updates editable org fields (not owner).
func (r *OrganizationRepo) UpdateOrganization(ctx context.Context, org *model.Organization) error {
	res, err := r.db.Exec(ctx, sqlUpdateOrg,
		org.ID, org.Name, org.Description, org.LogoURL, org.WebsiteURL, org.ContactEmail, org.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("organizationRepo.UpdateOrganization: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.UpdateOrganization: organization not found")
	}
	return nil
}

// AddMember adds a member to an organization.
func (r *OrganizationRepo) AddMember(ctx context.Context, m *model.OrganizationMember) error {
	status := m.MembershipStatus
	if status == "" {
		status = model.OrganizationMembershipActive
	}
	_, err := r.db.Exec(ctx, sqlAddMember,
		m.ID, m.OrganizationID, m.UserID, m.Role, status, m.JoinedAt,
	)
	if err != nil {
		return fmt.Errorf("organizationRepo.AddMember: %w", err)
	}
	return nil
}

// CreateInvitation creates or resets a pending invitation.
func (r *OrganizationRepo) CreateInvitation(ctx context.Context, inv *model.OrganizationInvitation) (*model.OrganizationInvitation, error) {
	row := r.db.QueryRow(ctx, sqlCreateInvitation,
		inv.ID, inv.OrganizationID, inv.InviterID, inv.InviteeEmail, inv.Status, inv.CreatedAt,
	)
	result, err := scanInvitation(row)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.CreateInvitation: %w", err)
	}
	return result, nil
}

// GetByID returns an organization by ID.
func (r *OrganizationRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Organization, error) {
	row := r.db.QueryRow(ctx, sqlGetOrgByID, id)
	org, err := scanOrganization(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("organizationRepo.GetByID: %w", err)
	}
	return org, nil
}

// ListByUserID returns organizations where the user has an active membership.
func (r *OrganizationRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*model.Organization, error) {
	rows, err := r.db.Query(ctx, sqlListOrgsByUserID, userID)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListByUserID: %w", err)
	}
	defer rows.Close()

	var results []*model.Organization
	for rows.Next() {
		org, err := scanOrganization(rows)
		if err != nil {
			return nil, fmt.Errorf("organizationRepo.ListByUserID scan: %w", err)
		}
		results = append(results, org)
	}
	return results, nil
}

// ListMembers returns all members of an organization (any status).
func (r *OrganizationRepo) ListMembers(ctx context.Context, orgID uuid.UUID) ([]*model.OrganizationMember, error) {
	rows, err := r.db.Query(ctx, sqlListMembers, orgID)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListMembers: %w", err)
	}
	defer rows.Close()

	var results []*model.OrganizationMember
	for rows.Next() {
		m, err := scanMember(rows)
		if err != nil {
			return nil, fmt.Errorf("organizationRepo.ListMembers scan: %w", err)
		}
		results = append(results, m)
	}
	return results, nil
}

// ListPendingInvitationsByEmail returns pending invitations for the given email.
func (r *OrganizationRepo) ListPendingInvitationsByEmail(ctx context.Context, email string) ([]*model.OrganizationInvitation, error) {
	rows, err := r.db.Query(ctx, sqlListPendingInvitationsByEmail, email)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListPendingInvitationsByEmail: %w", err)
	}
	defer rows.Close()

	var results []*model.OrganizationInvitation
	for rows.Next() {
		inv, err := scanPendingInvitationForInvitee(rows)
		if err != nil {
			return nil, fmt.Errorf("organizationRepo.ListPendingInvitationsByEmail scan: %w", err)
		}
		results = append(results, inv)
	}
	return results, nil
}

// ListInvitationsByOrganizationID returns all invitations for an organization (any status).
func (r *OrganizationRepo) ListInvitationsByOrganizationID(ctx context.Context, orgID uuid.UUID) ([]*model.OrganizationInvitation, error) {
	rows, err := r.db.Query(ctx, sqlListInvitationsByOrganizationID, orgID)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListInvitationsByOrganizationID: %w", err)
	}
	defer rows.Close()

	var results []*model.OrganizationInvitation
	for rows.Next() {
		inv, err := scanInvitation(rows)
		if err != nil {
			return nil, fmt.Errorf("organizationRepo.ListInvitationsByOrganizationID scan: %w", err)
		}
		results = append(results, inv)
	}
	return results, nil
}

// GetInvitationByID returns an invitation by ID.
func (r *OrganizationRepo) GetInvitationByID(ctx context.Context, id uuid.UUID) (*model.OrganizationInvitation, error) {
	row := r.db.QueryRow(ctx, sqlGetInvitationByID, id)
	inv, err := scanInvitation(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("organizationRepo.GetInvitationByID: %w", err)
	}
	return inv, nil
}

// IsMember returns true if the user has an active membership.
func (r *OrganizationRepo) IsMember(ctx context.Context, orgID, userID uuid.UUID) (bool, error) {
	var exists int
	err := r.db.QueryRow(ctx, sqlIsMember, orgID, userID).Scan(&exists)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, nil
		}
		return false, fmt.Errorf("organizationRepo.IsMember: %w", err)
	}
	return true, nil
}

// IsAdminOrOwner returns true if the user is an active admin or owner.
func (r *OrganizationRepo) IsAdminOrOwner(ctx context.Context, orgID, userID uuid.UUID) (bool, error) {
	var exists int
	err := r.db.QueryRow(ctx, sqlIsAdminOrOwner, orgID, userID).Scan(&exists)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, nil
		}
		return false, fmt.Errorf("organizationRepo.IsAdminOrOwner: %w", err)
	}
	return true, nil
}

// GetMember returns a membership row or nil.
func (r *OrganizationRepo) GetMember(ctx context.Context, orgID, userID uuid.UUID) (*model.OrganizationMember, error) {
	row := r.db.QueryRow(ctx, sqlGetMember, orgID, userID)
	m, err := scanMember(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("organizationRepo.GetMember: %w", err)
	}
	return m, nil
}

// RemoveMember deletes a membership row.
func (r *OrganizationRepo) RemoveMember(ctx context.Context, orgID, userID uuid.UUID) error {
	res, err := r.db.Exec(ctx, sqlRemoveMember, orgID, userID)
	if err != nil {
		return fmt.Errorf("organizationRepo.RemoveMember: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.RemoveMember: member not found")
	}
	return nil
}

// SetMemberMembershipStatus updates suspended/active.
func (r *OrganizationRepo) SetMemberMembershipStatus(ctx context.Context, orgID, userID uuid.UUID, status model.OrganizationMembershipStatus) error {
	res, err := r.db.Exec(ctx, sqlSetMemberMembershipStatus, orgID, userID, status)
	if err != nil {
		return fmt.Errorf("organizationRepo.SetMemberMembershipStatus: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.SetMemberMembershipStatus: member not found")
	}
	return nil
}

// UpdateInvitationStatus updates the status of an invitation.
func (r *OrganizationRepo) UpdateInvitationStatus(ctx context.Context, id uuid.UUID, status model.OrganizationInvitationStatus) error {
	result, err := r.db.Exec(ctx, sqlUpdateInvitationStatus, id, status)
	if err != nil {
		return fmt.Errorf("organizationRepo.UpdateInvitationStatus: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.UpdateInvitationStatus: invitation not found")
	}
	return nil
}

// ResendPendingInvitation updates inviter and timestamp for a pending invitation.
func (r *OrganizationRepo) ResendPendingInvitation(
	ctx context.Context,
	invitationID, organizationID, newInviterID uuid.UUID,
	createdAt time.Time,
) (*model.OrganizationInvitation, error) {
	row := r.db.QueryRow(ctx, sqlResendPendingInvitation, invitationID, organizationID, newInviterID, createdAt)
	inv, err := scanInvitation(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("organizationRepo.ResendPendingInvitation: invitation not found or not pending")
		}
		return nil, fmt.Errorf("organizationRepo.ResendPendingInvitation: %w", err)
	}
	return inv, nil
}

// ListNewsByOrganization lists news posts for an org (newest first).
func (r *OrganizationRepo) ListNewsByOrganization(ctx context.Context, orgID uuid.UUID, limit int, before *time.Time) ([]*model.OrganizationNews, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, sqlListNews, orgID, before, limit)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListNewsByOrganization: %w", err)
	}
	defer rows.Close()

	var out []*model.OrganizationNews
	for rows.Next() {
		n, err := scanNews(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
}

// GetNewsByID returns a news row or nil.
func (r *OrganizationRepo) GetNewsByID(ctx context.Context, id uuid.UUID) (*model.OrganizationNews, error) {
	row := r.db.QueryRow(ctx, sqlGetNewsByID, id)
	n, err := scanNews(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("organizationRepo.GetNewsByID: %w", err)
	}
	return n, nil
}

// CreateNews inserts a news post.
func (r *OrganizationRepo) CreateNews(ctx context.Context, n *model.OrganizationNews) error {
	_, err := r.db.Exec(ctx, sqlInsertNews,
		n.ID, n.OrganizationID, n.AuthorUserID, n.Title, n.Description, n.ImageURL, nullableJSON(n.RichMetadata), n.CreatedAt, n.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("organizationRepo.CreateNews: %w", err)
	}
	return nil
}

// UpdateNews updates a news post.
func (r *OrganizationRepo) UpdateNews(ctx context.Context, n *model.OrganizationNews) error {
	res, err := r.db.Exec(ctx, sqlUpdateNews,
		n.ID, n.Title, n.Description, n.ImageURL, nullableJSON(n.RichMetadata), n.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("organizationRepo.UpdateNews: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.UpdateNews: not found")
	}
	return nil
}

// DeleteNews removes a news post.
func (r *OrganizationRepo) DeleteNews(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.Exec(ctx, sqlDeleteNews, id)
	if err != nil {
		return fmt.Errorf("organizationRepo.DeleteNews: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.DeleteNews: not found")
	}
	return nil
}

// ListMessagesByOrganization lists chat messages (newest first).
func (r *OrganizationRepo) ListMessagesByOrganization(ctx context.Context, orgID uuid.UUID, limit int, before *time.Time) ([]*model.OrganizationMessage, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, sqlListMessages, orgID, before, limit)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListMessagesByOrganization: %w", err)
	}
	defer rows.Close()

	var out []*model.OrganizationMessage
	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, nil
}

// CreateMessage inserts a chat message.
func (r *OrganizationRepo) CreateMessage(ctx context.Context, m *model.OrganizationMessage) error {
	_, err := r.db.Exec(ctx, sqlInsertMessage,
		m.ID, m.OrganizationID, m.AuthorUserID, m.Body, m.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("organizationRepo.CreateMessage: %w", err)
	}
	return nil
}

// GetMessageByID returns a chat message by primary key.
func (r *OrganizationRepo) GetMessageByID(ctx context.Context, id uuid.UUID) (*model.OrganizationMessage, error) {
	row := r.db.QueryRow(ctx, sqlGetMessageByID, id)
	m, err := scanMessage(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("organizationRepo.GetMessageByID: %w", err)
	}
	return m, nil
}

// DeleteMessage removes a message; orgID must match the row (defense in depth).
func (r *OrganizationRepo) DeleteMessage(ctx context.Context, orgID, messageID uuid.UUID) error {
	res, err := r.db.Exec(ctx, sqlDeleteMessage, messageID, orgID)
	if err != nil {
		return fmt.Errorf("organizationRepo.DeleteMessage: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.DeleteMessage: not found")
	}
	return nil
}

func nullableJSON(b []byte) interface{} {
	if len(b) == 0 {
		return nil
	}
	return b
}

func scanOrganization(row pgx.Row) (*model.Organization, error) {
	var o model.Organization
	err := row.Scan(&o.ID, &o.Name, &o.Description, &o.LogoURL, &o.WebsiteURL, &o.ContactEmail, &o.OwnerUserID, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func scanMember(row pgx.Row) (*model.OrganizationMember, error) {
	var m model.OrganizationMember
	err := row.Scan(&m.ID, &m.OrganizationID, &m.UserID, &m.Role, &m.MembershipStatus, &m.JoinedAt)
	if err != nil {
		return nil, err
	}
	if m.MembershipStatus == "" {
		m.MembershipStatus = model.OrganizationMembershipActive
	}
	return &m, nil
}

func scanInvitation(row pgx.Row) (*model.OrganizationInvitation, error) {
	var inv model.OrganizationInvitation
	err := row.Scan(&inv.ID, &inv.OrganizationID, &inv.InviterID, &inv.InviteeEmail, &inv.Status, &inv.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func scanPendingInvitationForInvitee(row pgx.Row) (*model.OrganizationInvitation, error) {
	var inv model.OrganizationInvitation
	err := row.Scan(
		&inv.ID, &inv.OrganizationID, &inv.InviterID, &inv.InviteeEmail, &inv.Status, &inv.CreatedAt,
		&inv.OrganizationName, &inv.InviterNickname,
	)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func scanNews(row pgx.Row) (*model.OrganizationNews, error) {
	var n model.OrganizationNews
	var meta []byte
	err := row.Scan(&n.ID, &n.OrganizationID, &n.AuthorUserID, &n.Title, &n.Description, &n.ImageURL, &meta, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("scanNews: %w", err)
	}
	n.RichMetadata = meta
	return &n, nil
}

func scanMessage(row pgx.Row) (*model.OrganizationMessage, error) {
	var m model.OrganizationMessage
	err := row.Scan(&m.ID, &m.OrganizationID, &m.AuthorUserID, &m.Body, &m.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("scanMessage: %w", err)
	}
	return &m, nil
}
