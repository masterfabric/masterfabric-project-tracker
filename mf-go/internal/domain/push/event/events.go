package event

// Push / OneSignal-related async event types (REST API calls run only on mf-go).
const (
	EventAdminBroadcastPush = "push.admin.broadcast"
)

// AdminBroadcastPushPayload is published after an admin creates an in-app broadcast and opts into push.
type AdminBroadcastPushPayload struct {
	NotificationID string `json:"notification_id"`
	Title          string `json:"title"`
	Subtitle       string `json:"subtitle"`
	Message        string `json:"message"`
	ActionURL      string `json:"action_url"`
	Category       string `json:"category"`
}
