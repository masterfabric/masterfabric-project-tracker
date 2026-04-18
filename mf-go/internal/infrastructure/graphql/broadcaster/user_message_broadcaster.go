package broadcaster

import (
	"log/slog"
	"sync"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/graphql/model"
)

// UserMessageBroadcaster distributes user messages to subscribed clients.
type UserMessageBroadcaster struct {
	mu        sync.RWMutex
	observers map[string]map[chan *model.UserMessagePayload]struct{}
}

// NewUserMessageBroadcaster creates a new broadcaster.
func NewUserMessageBroadcaster() *UserMessageBroadcaster {
	return &UserMessageBroadcaster{
		observers: make(map[string]map[chan *model.UserMessagePayload]struct{}),
	}
}

// Subscribe registers a channel for the given user. Caller must close the channel when done.
func (b *UserMessageBroadcaster) Subscribe(userID uuid.UUID) chan *model.UserMessagePayload {
	ch := make(chan *model.UserMessagePayload, 1)
	key := userID.String()
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.observers[key] == nil {
		b.observers[key] = make(map[chan *model.UserMessagePayload]struct{})
	}
	b.observers[key][ch] = struct{}{}
	slog.Info("ws user-message subscribed", slog.String("user_id", key), slog.Int("subscriber_count", len(b.observers[key])))
	return ch
}

// Unsubscribe removes the channel for the user.
func (b *UserMessageBroadcaster) Unsubscribe(userID uuid.UUID, ch chan *model.UserMessagePayload) {
	key := userID.String()
	b.mu.Lock()
	defer b.mu.Unlock()
	if obs, ok := b.observers[key]; ok {
		delete(obs, ch)
		close(ch)
		slog.Info("ws user-message unsubscribed", slog.String("user_id", key), slog.Int("subscriber_count", len(obs)))
		if len(obs) == 0 {
			delete(b.observers, key)
		}
	}
}

// Broadcast sends the message to all subscribers for the user.
func (b *UserMessageBroadcaster) Broadcast(userID uuid.UUID, msg *model.UserMessagePayload) {
	key := userID.String()
	b.mu.RLock()
	obs := b.observers[key]
	if obs == nil {
		b.mu.RUnlock()
		return
	}
	count := len(obs)
	chans := make([]chan *model.UserMessagePayload, 0, len(obs))
	for ch := range obs {
		chans = append(chans, ch)
	}
	b.mu.RUnlock()

	slog.Info(
		"ws user-message broadcast",
		slog.String("user_id", key),
		slog.String("message_id", msg.ID.String()),
		slog.Int("subscriber_count", count),
	)

	for _, ch := range chans {
		select {
		case ch <- msg:
		default:
			// Channel full or closed, skip
		}
	}
}
