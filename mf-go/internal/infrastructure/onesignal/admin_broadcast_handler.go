package onesignal

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	pushevent "github.com/masterfabric/masterfabric_go_basic/internal/domain/push/event"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/events"
)

// AdminBroadcastPushHandler sends a segment push (e.g. "All") for admin-originated broadcasts.
// It runs the HTTP call in a goroutine so GraphQL / in-process bus handlers return quickly.
func AdminBroadcastPushHandler(client *Client, log *slog.Logger) events.Handler {
	return func(ctx context.Context, ev events.Event) error {
		if ev.Type != pushevent.EventAdminBroadcastPush {
			return nil
		}
		var p pushevent.AdminBroadcastPushPayload
		switch x := ev.Payload.(type) {
		case pushevent.AdminBroadcastPushPayload:
			p = x
		default:
			raw, err := json.Marshal(ev.Payload)
			if err != nil {
				if log != nil {
					log.Warn("push admin broadcast: marshal payload", slog.Any("error", err))
				}
				return nil
			}
			if err := json.Unmarshal(raw, &p); err != nil {
				if log != nil {
					log.Warn("push admin broadcast: unmarshal payload", slog.Any("error", err))
				}
				return nil
			}
		}

		if client == nil || !client.Enabled() {
			if log != nil {
				log.Debug("push admin broadcast skipped (onesignal disabled)")
			}
			return nil
		}

		title := p.Title
		if title == "" {
			title = "Notification"
		}
		bodyText := p.Message
		if bodyText == "" && p.Subtitle != "" {
			bodyText = p.Subtitle
		}

		go func() {
			cctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
			defer cancel()
			_, err := client.CreateNotification(cctx, CreateNotificationInput{
				Segments: []string{"All"},
				Headings: map[string]string{"en": title, "tr": title},
				Contents: map[string]string{"en": bodyText, "tr": bodyText},
				Data: map[string]interface{}{
					"type":            "admin_broadcast",
					"notification_id": p.NotificationID,
					"category":        p.Category,
					"action_url":      p.ActionURL,
				},
				CollapseID: "mf-admin-broadcast-" + p.NotificationID,
			})
			if err != nil && log != nil {
				log.Warn("push admin broadcast: onesignal", slog.String("notification_id", p.NotificationID), slog.Any("error", err))
			}
		}()

		return nil
	}
}
