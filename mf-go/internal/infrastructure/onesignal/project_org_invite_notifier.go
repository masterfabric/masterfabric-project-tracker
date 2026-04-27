package onesignal

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	settingsRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/settings/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// ProjectOrgInviteNotifier sends cross-org project share invites to the participant org owner via OneSignal.
type ProjectOrgInviteNotifier struct {
	client   *Client
	settings settingsRepo.UserSettingsRepository
	log      *slog.Logger
}

// NewProjectOrgInviteNotifier returns a notifier or nil when OneSignal is disabled.
func NewProjectOrgInviteNotifier(
	client *Client,
	settings settingsRepo.UserSettingsRepository,
	log *slog.Logger,
) *ProjectOrgInviteNotifier {
	if client == nil || !client.Enabled() {
		return nil
	}
	return &ProjectOrgInviteNotifier{
		client:   client,
		settings: settings,
		log:      log,
	}
}

// ProjectOrgInvitePending implements push.ProjectOrgInviteOneSignal.
func (n *ProjectOrgInviteNotifier) ProjectOrgInvitePending(ctx context.Context, ownerUserID uuid.UUID, hostOrgName, projectName string, projectID, participantOrgID uuid.UUID) {
	if n == nil {
		return
	}
	go n.run(context.Background(), func(ctx context.Context) {
		if !n.recipientAllowsPush(ctx, ownerUserID) {
			return
		}
		host := hostOrgName
		if host == "" {
			host = "An organization"
		}
		proj := projectName
		if proj == "" {
			proj = "a project"
		}
		titleEn := "Project invitation"
		titleTr := "Proje daveti"
		bodyEn := host + " invited your organization to collaborate on \"" + proj + "\"."
		bodyTr := host + " organizasyonunuzu \"" + proj + "\" projesinde iş birliği yapmaya davet etti."
		_, err := n.client.CreateNotification(ctx, CreateNotificationInput{
			ExternalIDs: []string{ownerUserID.String()},
			Headings:    map[string]string{"en": titleEn, "tr": titleTr},
			Contents:    map[string]string{"en": bodyEn, "tr": bodyTr},
			Data: map[string]interface{}{
				"type":                        "project_org_invite_pending",
				"project_id":                  projectID.String(),
				"participant_organization_id": participantOrgID.String(),
				"category":                    "organization",
				"notification_id":             "mf-project-org-invite-" + projectID.String() + "-" + participantOrgID.String(),
			},
		})
		if err != nil && n.log != nil {
			n.log.Warn("project org invite push failed", slog.Any("error", err))
		}
	})
}

func (n *ProjectOrgInviteNotifier) run(ctx context.Context, fn func(context.Context)) {
	cctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	fn(cctx)
}

func (n *ProjectOrgInviteNotifier) recipientAllowsPush(ctx context.Context, userID uuid.UUID) bool {
	s, err := n.settings.FindByUserID(ctx, userID)
	if err != nil {
		if domainErr.Is(err, domainErr.ErrSettingsNotFound) {
			return true
		}
		if n.log != nil {
			n.log.Debug("project org invite push: settings lookup failed", slog.String("user_id", userID.String()), slog.Any("error", err))
		}
		return true
	}
	return s.NotificationsOn
}
