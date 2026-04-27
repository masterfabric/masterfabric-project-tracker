package push

import (
	"context"

	"github.com/google/uuid"
)

// ProjectOrgInviteOneSignal notifies the participant org owner about a pending cross-org project invite (GFG-179).
// Implementations are optional; nil means no outbound push.
type ProjectOrgInviteOneSignal interface {
	ProjectOrgInvitePending(ctx context.Context, ownerUserID uuid.UUID, hostOrgName, projectName string, projectID, participantOrgID uuid.UUID)
}
