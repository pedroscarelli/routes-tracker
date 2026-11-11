package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/segmentio/kafka-go"
)

// MessageWriter is the part of *kafka.Writer the hub uses.
type MessageWriter interface {
	WriteMessages(ctx context.Context, msgs ...kafka.Message) error
}

type EventHub struct {
	routes           RouteRepository
	freightService   *FreightService
	freightWriter    MessageWriter
	simulationWriter MessageWriter
	stepInterval     time.Duration
}

func NewEventHub(
	routes RouteRepository,
	freightService *FreightService,
	freightWriter MessageWriter,
	simulationWriter MessageWriter,
	stepInterval time.Duration,
) *EventHub {
	return &EventHub{
		routes:           routes,
		freightService:   freightService,
		freightWriter:    freightWriter,
		simulationWriter: simulationWriter,
		stepInterval:     stepInterval,
	}
}

func (eh *EventHub) HandleEvent(ctx context.Context, message []byte) error {
	var baseEvent struct {
		EventName string `json:"event"`
	}

	if err := json.Unmarshal(message, &baseEvent); err != nil {
		return fmt.Errorf("error unmarshalling event: %w", err)
	}

	switch baseEvent.EventName {
	case "RouteCreated":
		var event RouteCreatedEvent
		if err := json.Unmarshal(message, &event); err != nil {
			return fmt.Errorf("error unmarshalling event: %w", err)
		}
		return eh.handleRouteCreated(ctx, event)

	case "DeliveryStarted":
		var event DeliveryStartedEvent
		if err := json.Unmarshal(message, &event); err != nil {
			return fmt.Errorf("error unmarshalling event: %w", err)
		}
		return eh.handleDeliveryStarted(ctx, event)

	default:
		return fmt.Errorf("unknown event type %q", baseEvent.EventName)
	}
}

func (eh *EventHub) handleRouteCreated(ctx context.Context, event RouteCreatedEvent) error {
	if event.RouteID == "" {
		return fmt.Errorf("RouteCreated event without an id")
	}

	route := NewRoute(event.RouteID, event.Distance, event.Directions)
	route.FreightPrice = eh.freightService.Calculate(route.Distance)
	if err := eh.routes.SaveRoute(ctx, route); err != nil {
		return fmt.Errorf("saving route %s: %w", route.ID, err)
	}

	return eh.publish(ctx, eh.freightWriter, route.ID, NewFreightCalculatedEvent(route.ID, route.FreightPrice))
}

// handleDeliveryStarted loads the route and then streams one DriverMoved event
// per point in the background, so the consumer can keep reading other events.
func (eh *EventHub) handleDeliveryStarted(ctx context.Context, event DeliveryStartedEvent) error {
	route, err := eh.routes.GetRoute(ctx, event.RouteID)
	if err != nil {
		return fmt.Errorf("loading route %s: %w", event.RouteID, err)
	}

	go eh.simulateDelivery(ctx, route)
	return nil
}

func (eh *EventHub) simulateDelivery(ctx context.Context, route Route) {
	for i, direction := range route.Directions {
		if i > 0 {
			select {
			case <-ctx.Done():
				return
			case <-time.After(eh.stepInterval):
			}
		}

		moved := NewDriverMovedEvent(route.ID, direction.Lat, direction.Lng)
		if err := eh.publish(ctx, eh.simulationWriter, route.ID, moved); err != nil {
			log.Printf("route %s: %v", route.ID, err)
			return
		}
	}
}

func (eh *EventHub) publish(ctx context.Context, writer MessageWriter, key string, event any) error {
	value, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("encoding event: %w", err)
	}
	if err := writer.WriteMessages(ctx, kafka.Message{Key: []byte(key), Value: value}); err != nil {
		return fmt.Errorf("publishing event: %w", err)
	}
	return nil
}
