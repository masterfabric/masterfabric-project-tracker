package rabbitmq

import (
	"context"
	"log/slog"
	"sync"

	"github.com/masterfabric/masterfabric_go_basic/internal/shared/events"
)

// InProcessBus is a simple in-memory event bus for development/testing.
// It does NOT persist events and does NOT survive restarts.
type InProcessBus struct {
	mu       sync.RWMutex
	handlers map[string][]events.Handler
	log      *slog.Logger
}

// NewInProcessBus creates an in-memory event bus.
func NewInProcessBus(log *slog.Logger) *InProcessBus {
	return &InProcessBus{
		handlers: make(map[string][]events.Handler),
		log:      log,
	}
}

func (b *InProcessBus) Publish(ctx context.Context, routingKey string, event events.Event) error {
	b.mu.RLock()
	handlers := b.handlers[routingKey]
	b.mu.RUnlock()

	for _, h := range handlers {
		if err := h(ctx, event); err != nil {
			b.log.Error("in-process handler error", "routing_key", routingKey, "error", err)
		}
	}
	return nil
}

func (b *InProcessBus) Subscribe(routingKey string, handler events.Handler) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[routingKey] = append(b.handlers[routingKey], handler)
	return nil
}

func (b *InProcessBus) Close() error { return nil }
