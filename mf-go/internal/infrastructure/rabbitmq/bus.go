package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"

	"github.com/masterfabric/masterfabric_go_basic/internal/shared/events"
	amqp "github.com/rabbitmq/amqp091-go"
)

// Bus implements events.EventBus backed by RabbitMQ topic exchange.
type Bus struct {
	conn         *amqp.Connection
	ch           *amqp.Channel
	exchangeName string
	log          *slog.Logger
	mu           sync.RWMutex
	handlers     map[string][]events.Handler
}

// NewBus creates a connected RabbitMQ event bus.
func NewBus(url, exchange string, log *slog.Logger) (*Bus, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("dial rabbitmq: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("open channel: %w", err)
	}

	// Declare a durable topic exchange
	if err := ch.ExchangeDeclare(
		exchange,
		"topic",
		true,  // durable
		false, // auto-delete
		false, // internal
		false, // no-wait
		nil,
	); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("declare exchange %q: %w", exchange, err)
	}

	return &Bus{
		conn:         conn,
		ch:           ch,
		exchangeName: exchange,
		log:          log,
		handlers:     make(map[string][]events.Handler),
	}, nil
}

// Publish serialises the event to JSON and publishes it to the exchange.
func (b *Bus) Publish(ctx context.Context, routingKey string, event events.Event) error {
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	err = b.ch.PublishWithContext(ctx, b.exchangeName, routingKey, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	})
	if err != nil {
		return fmt.Errorf("publish to %q: %w", routingKey, err)
	}

	b.log.Debug("event published", "routing_key", routingKey, "type", event.Type)
	return nil
}

// Subscribe binds a queue to the exchange for the given routing key and attaches a handler.
func (b *Bus) Subscribe(routingKey string, handler events.Handler) error {
	queueName := fmt.Sprintf("mf.%s", routingKey)

	q, err := b.ch.QueueDeclare(queueName, true, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("declare queue %q: %w", queueName, err)
	}

	if err := b.ch.QueueBind(q.Name, routingKey, b.exchangeName, false, nil); err != nil {
		return fmt.Errorf("bind queue %q to %q: %w", q.Name, routingKey, err)
	}

	msgs, err := b.ch.Consume(q.Name, "", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("consume %q: %w", q.Name, err)
	}

	go func() {
		for d := range msgs {
			var event events.Event
			if err := json.Unmarshal(d.Body, &event); err != nil {
				b.log.Error("unmarshal event", "queue", q.Name, "error", err)
				_ = d.Nack(false, false)
				continue
			}

			if err := handler(context.Background(), event); err != nil {
				b.log.Error("handle event", "queue", q.Name, "type", event.Type, "error", err)
				_ = d.Nack(false, true) // requeue
				continue
			}

			_ = d.Ack(false)
		}
	}()

	return nil
}

// Close releases the RabbitMQ connection.
func (b *Bus) Close() error {
	if b.ch != nil {
		_ = b.ch.Close()
	}
	if b.conn != nil {
		return b.conn.Close()
	}
	return nil
}
