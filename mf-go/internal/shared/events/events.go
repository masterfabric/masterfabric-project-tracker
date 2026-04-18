package events

import "context"

// Event is the envelope for all domain events published to the bus.
type Event struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// Handler is a function that processes an event.
type Handler func(ctx context.Context, event Event) error

// EventBus is the interface for publishing and subscribing to domain events.
// Infrastructure provides the concrete implementation (RabbitMQ, in-process, etc.)
type EventBus interface {
	Publish(ctx context.Context, routingKey string, event Event) error
	Subscribe(routingKey string, handler Handler) error
	Close() error
}

// RabbitMQ routing keys (topic exchange)
const (
	TopicUserRegistered      = "iam.user.registered"
	TopicUserLoggedIn        = "iam.user.login"
	TopicUserLoggedOut       = "iam.user.logout"
	TopicUserUpdated         = "iam.user.updated"
	TopicUserDeleted         = "iam.user.deleted"
	TopicUserSettingsUpdated = "settings.user.updated"
	TopicAppSettingsUpdated  = "settings.app.updated"
	// TopicPushAdminBroadcast notifies subscribers to send an admin-originated push (OneSignal REST on mf-go).
	TopicPushAdminBroadcast = "push.admin.broadcast"
)
