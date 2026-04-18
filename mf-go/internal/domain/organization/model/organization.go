package model

import (
	"time"

	"github.com/google/uuid"
)

// Organization represents a team or workspace.
type Organization struct {
	ID           uuid.UUID
	Name         string
	Description  string
	LogoURL      string
	WebsiteURL   string
	ContactEmail string
	OwnerUserID  uuid.UUID
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// OrganizationMemberRole defines the role of a member in an organization.
type OrganizationMemberRole string

const (
	OrganizationMemberRoleOwner  OrganizationMemberRole = "owner"
	OrganizationMemberRoleAdmin  OrganizationMemberRole = "admin"
	OrganizationMemberRoleMember OrganizationMemberRole = "member"
)

// OrganizationMembershipStatus is active or suspended (passive).
type OrganizationMembershipStatus string

const (
	OrganizationMembershipActive    OrganizationMembershipStatus = "active"
	OrganizationMembershipSuspended OrganizationMembershipStatus = "suspended"
)

// OrganizationMember represents a user's membership in an organization.
type OrganizationMember struct {
	ID               uuid.UUID
	OrganizationID   uuid.UUID
	UserID           uuid.UUID
	Role             OrganizationMemberRole
	MembershipStatus OrganizationMembershipStatus
	JoinedAt         time.Time
}

// OrganizationNews is an announcement visible to org members.
type OrganizationNews struct {
	ID             uuid.UUID
	OrganizationID uuid.UUID
	AuthorUserID   uuid.UUID
	Title          string
	Description    string
	ImageURL       string
	RichMetadata   []byte // JSON; nil if empty
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// OrganizationMessage is a message in the org-wide channel.
type OrganizationMessage struct {
	ID             uuid.UUID
	OrganizationID uuid.UUID
	AuthorUserID   uuid.UUID
	Body           string
	CreatedAt      time.Time
}

// OrganizationInvitationStatus defines the status of an invitation.
type OrganizationInvitationStatus string

const (
	OrganizationInvitationStatusPending  OrganizationInvitationStatus = "pending"
	OrganizationInvitationStatusAccepted OrganizationInvitationStatus = "accepted"
	OrganizationInvitationStatusDeclined OrganizationInvitationStatus = "declined"
	OrganizationInvitationStatusRevoked  OrganizationInvitationStatus = "revoked"
)

// OrganizationInvitation represents an invite to join an organization.
type OrganizationInvitation struct {
	ID             uuid.UUID
	OrganizationID uuid.UUID
	InviterID      uuid.UUID
	InviteeEmail   string
	Status         OrganizationInvitationStatus
	CreatedAt      time.Time
	// OrganizationName and InviterNickname are populated only by ListPendingInvitationsByEmail (invitee UX).
	OrganizationName string
	InviterNickname    string
}

// OrganizationProject is a project workspace inside an organization.
type OrganizationProject struct {
	ID               uuid.UUID
	OrganizationID   uuid.UUID
	Name             string
	Description      string
	CreatedByUserID  uuid.UUID
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// OrganizationProjectMember links an org user to a project roster.
type OrganizationProjectMember struct {
	ID        uuid.UUID
	ProjectID uuid.UUID
	UserID    uuid.UUID
	AddedAt   time.Time
}

// OrganizationProjectTodoStatus is open or done.
type OrganizationProjectTodoStatus string

const (
	OrganizationProjectTodoOpen OrganizationProjectTodoStatus = "open"
	OrganizationProjectTodoDone OrganizationProjectTodoStatus = "done"
)

// OrganizationProjectTodo is a lightweight task on a project.
type OrganizationProjectTodo struct {
	ID                uuid.UUID
	ProjectID         uuid.UUID
	Title             string
	Status            OrganizationProjectTodoStatus
	CreatedByUserID   uuid.UUID
	AssignedToUserID  *uuid.UUID // optional; set when admin/owner delegates
	DueAt             *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// OrganizationProjectTodoSubtask is a single-level checklist item under a project todo (GFG-117).
type OrganizationProjectTodoSubtask struct {
	ID            uuid.UUID
	ProjectTodoID uuid.UUID
	Title         string
	Completed     bool
	SortOrder     int
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// OrganizationProjectPurchaseStatus tracks procurement state for a line item.
type OrganizationProjectPurchaseStatus string

const (
	OrganizationProjectPurchaseRequested  OrganizationProjectPurchaseStatus = "requested"
	OrganizationProjectPurchasePurchased  OrganizationProjectPurchaseStatus = "purchased"
	OrganizationProjectPurchaseCancelled  OrganizationProjectPurchaseStatus = "cancelled"
)

// OrganizationProjectPurchase is a purchase line item on a project (GFG-113).
type OrganizationProjectPurchase struct {
	ID              uuid.UUID
	ProjectID       uuid.UUID
	ProductName     string
	TaxRate         float64
	ProductPurpose  string
	Price           float64
	Quantity        float64
	ProductLink     *string
	Status          OrganizationProjectPurchaseStatus
	StatusNote      string
	Currency        string
	CreatedByUserID uuid.UUID
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
