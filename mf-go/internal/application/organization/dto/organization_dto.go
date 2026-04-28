package dto

// CreateOrganizationRequest is the input for creating an organization.
type CreateOrganizationRequest struct {
	OwnerUserID string
	Name        string
}

// OrganizationResponse is the output for organization operations.
type OrganizationResponse struct {
	ID           string
	Name         string
	Description  string
	LogoURL      string
	WebsiteURL   string
	ContactEmail string
	OwnerUserID  string
	CreatedAt    string
	UpdatedAt    string
}

// UpdateOrganizationRequest updates org profile fields (admin/owner).
type UpdateOrganizationRequest struct {
	OrganizationID string
	ActorUserID    string
	Name           *string
	Description    *string
	LogoURL        *string
	WebsiteURL     *string
	ContactEmail   *string
}

// InviteToOrganizationRequest is the input for inviting a user to an organization.
type InviteToOrganizationRequest struct {
	OrganizationID string
	InviterID      string
	InviteeEmail   string
}

// AcceptInvitationRequest is the input for accepting an invitation.
type AcceptInvitationRequest struct {
	InvitationID string
	UserID       string
	UserEmail    string
}

// DeclineInvitationRequest is the input for declining an invitation.
type DeclineInvitationRequest struct {
	InvitationID string
	UserID       string
	UserEmail    string // must match invitee_email to verify identity
}

// OrganizationMemberResponse is the output for organization member operations.
type OrganizationMemberResponse struct {
	ID                 string
	OrganizationID     string
	UserID             string
	UserNickname       string
	Role               string
	MembershipStatus   string
	JoinedAt           string
}

// OrganizationInvitationResponse is the output for invitation operations.
type OrganizationInvitationResponse struct {
	ID               string
	OrganizationID   string
	InviterID        string
	InviteeEmail     string
	Status           string
	CreatedAt        string
	OrganizationName string
	InviterNickname  string
}

// RemoveOrganizationMemberRequest removes a member (admin/owner).
type RemoveOrganizationMemberRequest struct {
	OrganizationID string
	ActorUserID    string
	TargetUserID   string
}

// SetOrganizationMemberSuspendedRequest toggles passive state.
type SetOrganizationMemberSuspendedRequest struct {
	OrganizationID string
	ActorUserID    string
	TargetUserID   string
	Suspended      bool
}

// OrganizationNewsResponse is a news item for GraphQL.
type OrganizationNewsResponse struct {
	ID             string
	OrganizationID string
	AuthorUserID   string
	AuthorNickname string
	Title          string
	Description    string
	ImageURL       string
	RichMetadata   *string // JSON string
	CreatedAt      string
	UpdatedAt      string
}

// CreateOrganizationNewsRequest creates a post (org owner only).
type CreateOrganizationNewsRequest struct {
	OrganizationID string
	ActorUserID    string
	Title          string
	Description    string
	ImageURL       string
	RichMetadata   *string
}

// UpdateOrganizationNewsRequest updates a post (org owner only).
type UpdateOrganizationNewsRequest struct {
	NewsID      string
	ActorUserID string
	Title       *string
	Description *string
	ImageURL    *string
	RichMetadata *string
}

// DeleteOrganizationNewsRequest deletes a post (org owner only).
type DeleteOrganizationNewsRequest struct {
	NewsID      string
	ActorUserID string
}

// OrganizationMessageResponse is a chat message.
type OrganizationMessageResponse struct {
	ID             string
	OrganizationID string
	AuthorUserID   string
	AuthorNickname string
	Body           string
	CreatedAt      string
}

// PostOrganizationMessageRequest posts to the org channel.
type PostOrganizationMessageRequest struct {
	OrganizationID string
	ActorUserID    string
	Body           string
}

// OrganizationProjectOrgInvitePendingResponse is a pending share invite for a participant org (GFG-179).
type OrganizationProjectOrgInvitePendingResponse struct {
	ProjectID            string
	ProjectName          string
	HostOrganizationID   string
	HostOrganizationName string
	InvitedAt            string
	CapabilitiesJSON     string
}

// OrganizationProjectOrgParticipationRowResponse is host-side linked org management row.
type OrganizationProjectOrgParticipationRowResponse struct {
	ParticipationID           string
	ProjectID                 string
	ParticipantOrganizationID string
	ParticipantOrganizationName string
	Status                    string
	CapabilitiesJSON          string
	InvitedByUserID           *string
	InvitedAt                 string
	RespondedAt               *string
	CreatedAt                 string
	UpdatedAt                 string
}

// OrganizationProjectResponse is a project under an organization.
type OrganizationProjectResponse struct {
	ID              string
	OrganizationID  string
	Name            string
	Description     string
	CreatedByUserID string
	CreatedAt       string
	UpdatedAt       string
}

// OrganizationProjectMemberResponse is a user assigned to a project.
type OrganizationProjectMemberResponse struct {
	ID           string
	ProjectID    string
	UserID       string
	UserNickname string
	AddedAt      string
}

// OrganizationProjectTodoResponse is a task on a project.
type OrganizationProjectTodoResponse struct {
	ID                string
	ProjectID         string
	Title             string
	Status            string
	CreatedByUserID   string
	AssignedToUserID  *string
	DueAt             *string
	CreatedAt         string
	UpdatedAt         string
}

// OrganizationProjectPurchaseResponse is a purchase line item on a project (GFG-113).
type OrganizationProjectPurchaseResponse struct {
	ID              string
	ProjectID       string
	ProductName     string
	TaxRate         float64
	ProductPurpose  string
	Price           float64
	Quantity        float64
	ProductLink     *string
	Status          string
	StatusNote      string
	Currency        string
	CreatedByUserID string
	CreatedAt       string
	UpdatedAt       string
}
