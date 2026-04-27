package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
)

// OrganizationRepository defines persistence for organizations, members, and invitations.
type OrganizationRepository interface {
	// Create
	Create(ctx context.Context, org *model.Organization) error
	AddMember(ctx context.Context, m *model.OrganizationMember) error
	CreateInvitation(ctx context.Context, inv *model.OrganizationInvitation) (*model.OrganizationInvitation, error)

	// Read
	GetByID(ctx context.Context, id uuid.UUID) (*model.Organization, error)
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]*model.Organization, error)
	ListMembers(ctx context.Context, orgID uuid.UUID) ([]*model.OrganizationMember, error)
	ListPendingInvitationsByEmail(ctx context.Context, email string) ([]*model.OrganizationInvitation, error)
	ListInvitationsByOrganizationID(ctx context.Context, orgID uuid.UUID) ([]*model.OrganizationInvitation, error)
	GetInvitationByID(ctx context.Context, id uuid.UUID) (*model.OrganizationInvitation, error)
	// IsMember is true for an active membership (not suspended).
	IsMember(ctx context.Context, orgID, userID uuid.UUID) (bool, error)
	// IsAdminOrOwner requires an active membership with admin or owner role.
	IsAdminOrOwner(ctx context.Context, orgID, userID uuid.UUID) (bool, error)
	GetMember(ctx context.Context, orgID, userID uuid.UUID) (*model.OrganizationMember, error)

	// Update
	UpdateInvitationStatus(ctx context.Context, id uuid.UUID, status model.OrganizationInvitationStatus) error
	// ResendPendingInvitation sets inviter and created_at for a pending invite (same org).
	ResendPendingInvitation(ctx context.Context, invitationID, organizationID, newInviterID uuid.UUID, createdAt time.Time) (*model.OrganizationInvitation, error)
	UpdateOrganization(ctx context.Context, org *model.Organization) error
	RemoveMember(ctx context.Context, orgID, userID uuid.UUID) error
	SetMemberMembershipStatus(ctx context.Context, orgID, userID uuid.UUID, status model.OrganizationMembershipStatus) error

	// News (members read; owner mutates via use case)
	ListNewsByOrganization(ctx context.Context, orgID uuid.UUID, limit int, before *time.Time) ([]*model.OrganizationNews, error)
	GetNewsByID(ctx context.Context, id uuid.UUID) (*model.OrganizationNews, error)
	CreateNews(ctx context.Context, n *model.OrganizationNews) error
	UpdateNews(ctx context.Context, n *model.OrganizationNews) error
	DeleteNews(ctx context.Context, id uuid.UUID) error

	// Org-wide messages
	ListMessagesByOrganization(ctx context.Context, orgID uuid.UUID, limit int, before *time.Time) ([]*model.OrganizationMessage, error)
	CreateMessage(ctx context.Context, m *model.OrganizationMessage) error
	GetMessageByID(ctx context.Context, id uuid.UUID) (*model.OrganizationMessage, error)
	DeleteMessage(ctx context.Context, orgID, messageID uuid.UUID) error

	// Organization projects (GFG-92)
	GetOrganizationProjectByID(ctx context.Context, id uuid.UUID) (*model.OrganizationProject, error)
	// UserMayViewProjectViaAcceptedParticipation is true when the user is an active member of a participant org
	// with an accepted link to the project (GFG-172 / GFG-179 cross-org read path).
	UserMayViewProjectViaAcceptedParticipation(ctx context.Context, projectID, userID uuid.UUID) (bool, error)
	ListOrganizationProjectsByOrgID(ctx context.Context, orgID uuid.UUID) ([]*model.OrganizationProject, error)
	// ListOrganizationProjectsForOrgMember lists projects the user is on the roster for (within org).
	ListOrganizationProjectsForOrgMember(ctx context.Context, orgID, userID uuid.UUID) ([]*model.OrganizationProject, error)
	CreateOrganizationProject(ctx context.Context, p *model.OrganizationProject) error
	UpdateOrganizationProject(ctx context.Context, p *model.OrganizationProject) error
	DeleteOrganizationProject(ctx context.Context, id uuid.UUID) error
	AddOrganizationProjectMember(ctx context.Context, m *model.OrganizationProjectMember) error
	RemoveOrganizationProjectMember(ctx context.Context, projectID, userID uuid.UUID) error
	ListOrganizationProjectMembers(ctx context.Context, projectID uuid.UUID) ([]*model.OrganizationProjectMember, error)
	IsOrganizationProjectMember(ctx context.Context, projectID, userID uuid.UUID) (bool, error)
	ListOrganizationProjectTodos(ctx context.Context, projectID uuid.UUID) ([]*model.OrganizationProjectTodo, error)
	GetOrganizationProjectTodoByID(ctx context.Context, id uuid.UUID) (*model.OrganizationProjectTodo, error)
	CreateOrganizationProjectTodo(ctx context.Context, t *model.OrganizationProjectTodo) error
	UpdateOrganizationProjectTodo(ctx context.Context, t *model.OrganizationProjectTodo) error
	DeleteOrganizationProjectTodo(ctx context.Context, id uuid.UUID) error

	// Organization project todo subtasks (GFG-117); caller must verify project todo editor access.
	ListOrganizationProjectTodoSubtasksByParentID(ctx context.Context, projectTodoID uuid.UUID) ([]*model.OrganizationProjectTodoSubtask, error)
	GetOrganizationProjectTodoSubtaskByID(ctx context.Context, id uuid.UUID) (*model.OrganizationProjectTodoSubtask, error)
	CountOrganizationProjectTodoSubtasksByParentID(ctx context.Context, projectTodoID uuid.UUID) (int, error)
	NextOrganizationProjectTodoSubtaskSortOrder(ctx context.Context, projectTodoID uuid.UUID) (int, error)
	CreateOrganizationProjectTodoSubtask(ctx context.Context, s *model.OrganizationProjectTodoSubtask) error
	UpdateOrganizationProjectTodoSubtask(ctx context.Context, s *model.OrganizationProjectTodoSubtask) error
	DeleteOrganizationProjectTodoSubtask(ctx context.Context, id, projectTodoID uuid.UUID) error

	// Organization project purchases (GFG-113)
	ListOrganizationProjectPurchases(ctx context.Context, projectID uuid.UUID) ([]*model.OrganizationProjectPurchase, error)
	GetOrganizationProjectPurchaseByID(ctx context.Context, id uuid.UUID) (*model.OrganizationProjectPurchase, error)
	CreateOrganizationProjectPurchase(ctx context.Context, p *model.OrganizationProjectPurchase) error
	UpdateOrganizationProjectPurchase(ctx context.Context, p *model.OrganizationProjectPurchase) error
	DeleteOrganizationProjectPurchase(ctx context.Context, id uuid.UUID) error

	// GFG-174: org owner dashboard (bounded aggregate queries).
	GetOwnerTodoDashboardStats(
		ctx context.Context,
		orgID uuid.UUID,
		projectFilter []uuid.UUID, // nil or empty = all org projects; General user todos are always in scope
		includeSubtasks bool,
		periodStart, periodEnd, prevStart, prevEnd time.Time,
	) (*model.OwnerTodoDashboardStats, error)
}
