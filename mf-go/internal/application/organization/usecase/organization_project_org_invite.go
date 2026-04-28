package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/push"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

const (
	auditEventOrgProjectInviteCreated  = "project_org_invite_created"
	auditEventOrgProjectInviteAccepted = "project_org_invite_accepted"
	auditEventOrgProjectInviteDeclined = "project_org_invite_declined"
)

func parseOrgProjectInviteCapabilitiesJSON(raw *string) ([]byte, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return []byte("{}"), nil
	}
	b := []byte(strings.TrimSpace(*raw))
	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, fmt.Errorf("capabilitiesJson must be a JSON object")
	}
	return b, nil
}

// CreateOrganizationProjectOrgInviteUseCase creates or re-opens a pending cross-org invite (host org admin/owner).
type CreateOrganizationProjectOrgInviteUseCase struct {
	repo orgRepo.OrganizationRepository
	push push.ProjectOrgInviteOneSignal
}

// NewCreateOrganizationProjectOrgInviteUseCase constructs the use case.
func NewCreateOrganizationProjectOrgInviteUseCase(repo orgRepo.OrganizationRepository, p push.ProjectOrgInviteOneSignal) *CreateOrganizationProjectOrgInviteUseCase {
	return &CreateOrganizationProjectOrgInviteUseCase{repo: repo, push: p}
}

// Execute inserts a pending invite or re-invites after declined/revoked.
func (uc *CreateOrganizationProjectOrgInviteUseCase) Execute(
	ctx context.Context,
	projectID, participantOrganizationID, actorUserID uuid.UUID,
	capabilitiesJSON *string,
) (*model.OrganizationProjectOrgParticipation, error) {
	p, err := uc.repo.GetOrganizationProjectByID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("createOrganizationProjectOrgInvite: %w", err)
	}
	if p == nil {
		return nil, domainErr.New("NOT_FOUND", "project not found", nil)
	}
	if participantOrganizationID == p.OrganizationID {
		return nil, domainErr.New("INVALID_ARGUMENT", "cannot invite the host organization as a participant", nil)
	}
	if err := ensureOrgAdminOrOwner(ctx, uc.repo, p.OrganizationID, actorUserID); err != nil {
		return nil, err
	}
	partOrg, err := uc.repo.GetByID(ctx, participantOrganizationID)
	if err != nil {
		return nil, fmt.Errorf("createOrganizationProjectOrgInvite: %w", err)
	}
	if partOrg == nil {
		return nil, domainErr.New("NOT_FOUND", "participant organization not found", nil)
	}
	caps, err := parseOrgProjectInviteCapabilitiesJSON(capabilitiesJSON)
	if err != nil {
		return nil, domainErr.New("INVALID_ARGUMENT", err.Error(), nil)
	}
	existing, err := uc.repo.GetOrganizationProjectOrgParticipation(ctx, projectID, participantOrganizationID)
	if err != nil {
		return nil, fmt.Errorf("createOrganizationProjectOrgInvite: %w", err)
	}
	hostOrg, _ := uc.repo.GetByID(ctx, p.OrganizationID)
	now := time.Now().UTC()

	var out *model.OrganizationProjectOrgParticipation
	switch {
	case existing == nil:
		row := &model.OrganizationProjectOrgParticipation{
			ID:                        uuid.New(),
			ProjectID:                 projectID,
			ParticipantOrganizationID: participantOrganizationID,
			Status:                    model.OrganizationProjectOrgParticipationPending,
			Capabilities:              caps,
			InvitedByUserID:           &actorUserID,
			InvitedAt:                 now,
			CreatedAt:                 now,
			UpdatedAt:                 now,
		}
		if err := uc.repo.InsertOrganizationProjectOrgParticipation(ctx, row); err != nil {
			return nil, fmt.Errorf("createOrganizationProjectOrgInvite: %w", err)
		}
		out = row
	case existing.Status == model.OrganizationProjectOrgParticipationPending:
		return nil, domainErr.New("CONFLICT", "an invite is already pending for this organization", nil)
	case existing.Status == model.OrganizationProjectOrgParticipationAccepted:
		return nil, domainErr.New("CONFLICT", "this organization is already linked to the project", nil)
	case existing.Status == model.OrganizationProjectOrgParticipationDeclined ||
		existing.Status == model.OrganizationProjectOrgParticipationRevoked:
		existing.Status = model.OrganizationProjectOrgParticipationPending
		existing.Capabilities = caps
		existing.InvitedByUserID = &actorUserID
		existing.InvitedAt = now
		existing.UpdatedAt = now
		if err := uc.repo.UpdateOrganizationProjectOrgParticipationReinvite(ctx, existing); err != nil {
			return nil, fmt.Errorf("createOrganizationProjectOrgInvite: %w", err)
		}
		out = existing
	default:
		return nil, domainErr.New("INTERNAL", "unknown participation status", nil)
	}

	meta, _ := json.Marshal(map[string]string{
		"participantOrganizationId": participantOrganizationID.String(),
		"hostOrganizationId":        p.OrganizationID.String(),
	})
	if err := uc.repo.InsertOrganizationProjectOrgAuditEvent(ctx, projectID, &actorUserID, auditEventOrgProjectInviteCreated, meta); err != nil {
		return nil, fmt.Errorf("createOrganizationProjectOrgInvite: audit: %w", err)
	}
	if uc.push != nil && hostOrg != nil {
		uc.push.ProjectOrgInvitePending(ctx, partOrg.OwnerUserID, hostOrg.Name, p.Name, projectID, participantOrganizationID)
	}
	refreshed, err := uc.repo.GetOrganizationProjectOrgParticipation(ctx, projectID, participantOrganizationID)
	if err != nil {
		return nil, fmt.Errorf("createOrganizationProjectOrgInvite: %w", err)
	}
	if refreshed != nil {
		return refreshed, nil
	}
	return out, nil
}

// AcceptOrganizationProjectOrgInviteUseCase accepts a pending invite (participant org owner only).
type AcceptOrganizationProjectOrgInviteUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewAcceptOrganizationProjectOrgInviteUseCase constructs the use case.
func NewAcceptOrganizationProjectOrgInviteUseCase(repo orgRepo.OrganizationRepository) *AcceptOrganizationProjectOrgInviteUseCase {
	return &AcceptOrganizationProjectOrgInviteUseCase{repo: repo}
}

// Execute transitions pending → accepted and adds the participant owner to the project roster when missing.
func (uc *AcceptOrganizationProjectOrgInviteUseCase) Execute(ctx context.Context, projectID, participantOrganizationID, actorUserID uuid.UUID) (*model.OrganizationProjectOrgParticipation, error) {
	partOrg, err := uc.repo.GetByID(ctx, participantOrganizationID)
	if err != nil {
		return nil, fmt.Errorf("acceptOrganizationProjectOrgInvite: %w", err)
	}
	if partOrg == nil {
		return nil, domainErr.New("NOT_FOUND", "participant organization not found", nil)
	}
	if partOrg.OwnerUserID != actorUserID {
		return nil, domainErr.New("FORBIDDEN", "only the participant organization owner may accept this invite", nil)
	}
	ok, err := uc.repo.IsMember(ctx, participantOrganizationID, actorUserID)
	if err != nil {
		return nil, fmt.Errorf("acceptOrganizationProjectOrgInvite: %w", err)
	}
	if !ok {
		return nil, domainErr.New("FORBIDDEN", "not a member of the participant organization", nil)
	}
	existing, err := uc.repo.GetOrganizationProjectOrgParticipation(ctx, projectID, participantOrganizationID)
	if err != nil {
		return nil, fmt.Errorf("acceptOrganizationProjectOrgInvite: %w", err)
	}
	if existing == nil || existing.Status != model.OrganizationProjectOrgParticipationPending {
		return nil, domainErr.New("NOT_FOUND", "no pending invite for this organization", nil)
	}
	out, err := uc.repo.AcceptOrganizationProjectOrgParticipation(ctx, projectID, participantOrganizationID)
	if err != nil {
		return nil, fmt.Errorf("acceptOrganizationProjectOrgInvite: %w", err)
	}
	if out == nil {
		return nil, domainErr.New("CONFLICT", "invite could not be accepted", nil)
	}
	meta, _ := json.Marshal(map[string]string{
		"participantOrganizationId": participantOrganizationID.String(),
	})
	if err := uc.repo.InsertOrganizationProjectOrgAuditEvent(ctx, projectID, &actorUserID, auditEventOrgProjectInviteAccepted, meta); err != nil {
		return nil, fmt.Errorf("acceptOrganizationProjectOrgInvite: audit: %w", err)
	}
	now := time.Now().UTC()
	member := &model.OrganizationProjectMember{
		ID:        uuid.New(),
		ProjectID: projectID,
		UserID:    partOrg.OwnerUserID,
		AddedAt:   now,
	}
	if err := uc.repo.AddOrganizationProjectMember(ctx, member); err != nil {
		return nil, fmt.Errorf("acceptOrganizationProjectOrgInvite: add owner to roster: %w", err)
	}
	return out, nil
}

// DeclineOrganizationProjectOrgInviteUseCase declines a pending invite (participant org owner only).
type DeclineOrganizationProjectOrgInviteUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewDeclineOrganizationProjectOrgInviteUseCase constructs the use case.
func NewDeclineOrganizationProjectOrgInviteUseCase(repo orgRepo.OrganizationRepository) *DeclineOrganizationProjectOrgInviteUseCase {
	return &DeclineOrganizationProjectOrgInviteUseCase{repo: repo}
}

// Execute transitions pending -> declined.
func (uc *DeclineOrganizationProjectOrgInviteUseCase) Execute(ctx context.Context, projectID, participantOrganizationID, actorUserID uuid.UUID) (*model.OrganizationProjectOrgParticipation, error) {
	partOrg, err := uc.repo.GetByID(ctx, participantOrganizationID)
	if err != nil {
		return nil, fmt.Errorf("declineOrganizationProjectOrgInvite: %w", err)
	}
	if partOrg == nil {
		return nil, domainErr.New("NOT_FOUND", "participant organization not found", nil)
	}
	if partOrg.OwnerUserID != actorUserID {
		return nil, domainErr.New("FORBIDDEN", "only the participant organization owner may decline this invite", nil)
	}
	ok, err := uc.repo.IsMember(ctx, participantOrganizationID, actorUserID)
	if err != nil {
		return nil, fmt.Errorf("declineOrganizationProjectOrgInvite: %w", err)
	}
	if !ok {
		return nil, domainErr.New("FORBIDDEN", "not a member of the participant organization", nil)
	}
	existing, err := uc.repo.GetOrganizationProjectOrgParticipation(ctx, projectID, participantOrganizationID)
	if err != nil {
		return nil, fmt.Errorf("declineOrganizationProjectOrgInvite: %w", err)
	}
	if existing == nil || existing.Status != model.OrganizationProjectOrgParticipationPending {
		return nil, domainErr.New("NOT_FOUND", "no pending invite for this organization", nil)
	}
	out, err := uc.repo.DeclineOrganizationProjectOrgParticipation(ctx, projectID, participantOrganizationID)
	if err != nil {
		return nil, fmt.Errorf("declineOrganizationProjectOrgInvite: %w", err)
	}
	if out == nil {
		return nil, domainErr.New("CONFLICT", "invite could not be declined", nil)
	}
	meta, _ := json.Marshal(map[string]string{
		"participantOrganizationId": participantOrganizationID.String(),
	})
	if err := uc.repo.InsertOrganizationProjectOrgAuditEvent(ctx, projectID, &actorUserID, auditEventOrgProjectInviteDeclined, meta); err != nil {
		return nil, fmt.Errorf("declineOrganizationProjectOrgInvite: audit: %w", err)
	}
	return out, nil
}

// ListPendingOrganizationProjectOrgInvitesUseCase lists pending invites for a participant org (owner only).
type ListPendingOrganizationProjectOrgInvitesUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewListPendingOrganizationProjectOrgInvitesUseCase constructs the use case.
func NewListPendingOrganizationProjectOrgInvitesUseCase(repo orgRepo.OrganizationRepository) *ListPendingOrganizationProjectOrgInvitesUseCase {
	return &ListPendingOrganizationProjectOrgInvitesUseCase{repo: repo}
}

// Execute returns pending cross-org invites for the given organization when the caller is its owner.
func (uc *ListPendingOrganizationProjectOrgInvitesUseCase) Execute(ctx context.Context, organizationID, callerUserID uuid.UUID) ([]*dto.OrganizationProjectOrgInvitePendingResponse, error) {
	if err := ensureOrgOwner(ctx, uc.repo, organizationID, callerUserID); err != nil {
		return nil, err
	}
	rows, err := uc.repo.ListPendingOrganizationProjectOrgInvitesForParticipantOrg(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("pendingOrganizationProjectOrgInvites: %w", err)
	}
	out := make([]*dto.OrganizationProjectOrgInvitePendingResponse, 0, len(rows))
	for _, row := range rows {
		caps := string(row.Capabilities)
		if caps == "" {
			caps = "{}"
		}
		out = append(out, &dto.OrganizationProjectOrgInvitePendingResponse{
			ProjectID:            row.ProjectID.String(),
			ProjectName:          row.ProjectName,
			HostOrganizationID:   row.HostOrganizationID.String(),
			HostOrganizationName: row.HostOrganizationName,
			InvitedAt:            row.InvitedAt.UTC().Format(time.RFC3339),
			CapabilitiesJSON:     caps,
		})
	}
	return out, nil
}
