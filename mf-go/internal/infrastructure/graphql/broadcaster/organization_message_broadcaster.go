package broadcaster

import (
	"log/slog"
	"sync"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/graphql/model"
)

// OrganizationMessageBroadcaster fans out new org chat messages to subscribers per organization.
type OrganizationMessageBroadcaster struct {
	mu        sync.RWMutex
	observers map[string]map[chan *model.OrganizationMessage]struct{}
}

// NewOrganizationMessageBroadcaster creates a broadcaster.
func NewOrganizationMessageBroadcaster() *OrganizationMessageBroadcaster {
	return &OrganizationMessageBroadcaster{
		observers: make(map[string]map[chan *model.OrganizationMessage]struct{}),
	}
}

func orgMessageKey(orgID uuid.UUID) string {
	return orgID.String()
}

// Subscribe registers a channel for the given organization.
func (b *OrganizationMessageBroadcaster) Subscribe(orgID uuid.UUID) chan *model.OrganizationMessage {
	ch := make(chan *model.OrganizationMessage, 8)
	key := orgMessageKey(orgID)
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.observers[key] == nil {
		b.observers[key] = make(map[chan *model.OrganizationMessage]struct{})
	}
	b.observers[key][ch] = struct{}{}
	slog.Info("ws org-message subscribed", slog.String("organization_id", key), slog.Int("subscriber_count", len(b.observers[key])))
	return ch
}

// Unsubscribe removes the channel.
func (b *OrganizationMessageBroadcaster) Unsubscribe(orgID uuid.UUID, ch chan *model.OrganizationMessage) {
	key := orgMessageKey(orgID)
	b.mu.Lock()
	defer b.mu.Unlock()
	if obs, ok := b.observers[key]; ok {
		delete(obs, ch)
		close(ch)
		slog.Info("ws org-message unsubscribed", slog.String("organization_id", key), slog.Int("subscriber_count", len(obs)))
		if len(obs) == 0 {
			delete(b.observers, key)
		}
	}
}

// Broadcast sends to all subscribers for that organization.
func (b *OrganizationMessageBroadcaster) Broadcast(orgID uuid.UUID, msg *model.OrganizationMessage) {
	key := orgMessageKey(orgID)
	b.mu.RLock()
	obs := b.observers[key]
	if obs == nil {
		b.mu.RUnlock()
		return
	}
	count := len(obs)
	chans := make([]chan *model.OrganizationMessage, 0, len(obs))
	for ch := range obs {
		chans = append(chans, ch)
	}
	b.mu.RUnlock()

	slog.Info(
		"ws org-message broadcast",
		slog.String("organization_id", key),
		slog.String("message_id", msg.ID.String()),
		slog.Int("subscriber_count", count),
	)
	for _, ch := range chans {
		select {
		case ch <- msg:
		default:
		}
	}
}
