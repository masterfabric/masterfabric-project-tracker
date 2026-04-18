package dto

import "github.com/google/uuid"

// OwnedOrganizationDeletionImpact describes an org that will be removed when its owner user is deleted.
type OwnedOrganizationDeletionImpact struct {
	OrganizationID   uuid.UUID
	Name             string
	OtherMemberCount int
}

// UserDeletionImpactResponse is returned by GetUserDeletionImpactUseCase (admin preview before delete).
type UserDeletionImpactResponse struct {
	UserID                          uuid.UUID
	Email                           string
	DisplayName                     string
	OwnedTodoCount                  int
	TodoAssigneeClearCount          int
	OrganizationMembershipCount     int
	OwnedOrganizations              []OwnedOrganizationDeletionImpact
	AddressCount                    int
	DeviceCount                     int
	HasUserSettings                 bool
	NotificationReadCount             int
	SessionCount                    int
	UserMessageCount                int
	PendingInvitationAsInviterCount int
	// Org team chat / news authored by this user (CASCADE-deleted with the user).
	OrganizationMessageAuthoredCount int
	OrganizationNewsAuthoredCount    int
	// OTP audit rows linked to this user (CASCADE-deleted with the user).
	OtpCodeHistoryCount int
}
