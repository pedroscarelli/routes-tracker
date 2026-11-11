package internal

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/segmentio/kafka-go"
)

type fakeRoutes struct {
	saved   map[string]Route
	saveErr error
}

func newFakeRoutes() *fakeRoutes { return &fakeRoutes{saved: map[string]Route{}} }

func (f *fakeRoutes) SaveRoute(_ context.Context, route Route) error {
	if f.saveErr != nil {
		return f.saveErr
	}
	f.saved[route.ID] = route
	return nil
}

func (f *fakeRoutes) GetRoute(_ context.Context, id string) (Route, error) {
	route, ok := f.saved[id]
	if !ok {
		return Route{}, errors.New("not found")
	}
	return route, nil
}

type fakeWriter struct {
	mu       sync.Mutex
	messages []kafka.Message
	err      error
	written  chan struct{}
}

func newFakeWriter() *fakeWriter { return &fakeWriter{written: make(chan struct{}, 100)} }

func (f *fakeWriter) WriteMessages(_ context.Context, msgs ...kafka.Message) error {
	if f.err != nil {
		return f.err
	}
	f.mu.Lock()
	f.messages = append(f.messages, msgs...)
	f.mu.Unlock()
	f.written <- struct{}{}
	return nil
}

func (f *fakeWriter) waitFor(t *testing.T, n int) []kafka.Message {
	t.Helper()
	for i := 0; i < n; i++ {
		select {
		case <-f.written:
		case <-time.After(2 * time.Second):
			t.Fatalf("timed out waiting for message %d of %d", i+1, n)
		}
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]kafka.Message(nil), f.messages...)
}

func newHub(routes *fakeRoutes, freight, simulation *fakeWriter) *EventHub {
	return NewEventHub(routes, NewFreightService(), freight, simulation, 10*time.Millisecond)
}

func TestFreightCalculate(t *testing.T) {
	tests := []struct {
		distance int
		want     float64
	}{
		{0, 0.30},
		{1, 0.45},
		{120, 18.30},
		{1000, 150.30},
	}
	for _, tt := range tests {
		if got := NewFreightService().Calculate(tt.distance); got != tt.want {
			t.Errorf("Calculate(%d) = %v, want %v", tt.distance, got, tt.want)
		}
	}
}

func TestRouteCreatedSavesRouteAndPublishesFreight(t *testing.T) {
	routes, freight, simulation := newFakeRoutes(), newFakeWriter(), newFakeWriter()
	hub := newHub(routes, freight, simulation)

	msg := `{"event":"RouteCreated","id":"route-1","distance":120,"directions":[{"lat":1,"lng":2}]}`
	if err := hub.HandleEvent(context.Background(), []byte(msg)); err != nil {
		t.Fatalf("HandleEvent: %v", err)
	}

	if got := routes.saved["route-1"].FreightPrice; got != 18.30 {
		t.Errorf("saved freight price = %v, want 18.30", got)
	}

	messages := freight.waitFor(t, 1)
	if string(messages[0].Key) != "route-1" {
		t.Errorf("key = %q, want route-1", messages[0].Key)
	}
	var event FreightCalculatedEvent
	if err := json.Unmarshal(messages[0].Value, &event); err != nil {
		t.Fatal(err)
	}
	if event != (FreightCalculatedEvent{EventName: "FreightCalculated", RouteID: "route-1", Amount: 18.30}) {
		t.Errorf("event = %+v", event)
	}
}

func TestRouteCreatedReturnsErrors(t *testing.T) {
	routes := newFakeRoutes()
	routes.saveErr = errors.New("mongo down")
	hub := newHub(routes, newFakeWriter(), newFakeWriter())

	err := hub.HandleEvent(context.Background(), []byte(`{"event":"RouteCreated","id":"route-1","distance":1}`))
	if err == nil || !strings.Contains(err.Error(), "mongo down") {
		t.Errorf("err = %v, want the save error", err)
	}

	freight := newFakeWriter()
	freight.err = errors.New("kafka down")
	hub = newHub(newFakeRoutes(), freight, newFakeWriter())
	err = hub.HandleEvent(context.Background(), []byte(`{"event":"RouteCreated","id":"route-1","distance":1}`))
	if err == nil || !strings.Contains(err.Error(), "kafka down") {
		t.Errorf("err = %v, want the publish error", err)
	}
}

func TestDeliveryStartedPublishesEveryPointInOrder(t *testing.T) {
	routes, simulation := newFakeRoutes(), newFakeWriter()
	routes.saved["route-1"] = Route{ID: "route-1", Directions: []Directions{{1, 1}, {2, 2}, {3, 3}, {4, 4}}}
	hub := newHub(routes, newFakeWriter(), simulation)

	if err := hub.HandleEvent(context.Background(), []byte(`{"event":"DeliveryStarted","route_id":"route-1"}`)); err != nil {
		t.Fatalf("HandleEvent: %v", err)
	}

	messages := simulation.waitFor(t, 4)
	for i, msg := range messages {
		var event DriverMovedEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			t.Fatal(err)
		}
		want := float64(i + 1)
		if event.EventName != "DriverMoved" || event.RouteID != "route-1" || event.Lat != want || event.Lng != want {
			t.Errorf("message %d = %+v", i, event)
		}
	}
}

func TestConcurrentDeliveriesDoNotMixUp(t *testing.T) {
	routes, simulation := newFakeRoutes(), newFakeWriter()
	routes.saved["a"] = Route{ID: "a", Directions: []Directions{{1, 1}, {1, 1}, {1, 1}}}
	routes.saved["b"] = Route{ID: "b", Directions: []Directions{{2, 2}, {2, 2}, {2, 2}}}
	hub := newHub(routes, newFakeWriter(), simulation)

	for _, id := range []string{"a", "b"} {
		if err := hub.HandleEvent(context.Background(), []byte(`{"event":"DeliveryStarted","route_id":"`+id+`"}`)); err != nil {
			t.Fatal(err)
		}
	}

	counts := map[string]int{}
	for _, msg := range simulation.waitFor(t, 6) {
		var event DriverMovedEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			t.Fatal(err)
		}
		if (event.RouteID == "a" && event.Lat != 1) || (event.RouteID == "b" && event.Lat != 2) {
			t.Errorf("point from the wrong route: %+v", event)
		}
		counts[event.RouteID]++
	}
	if counts["a"] != 3 || counts["b"] != 3 {
		t.Errorf("counts = %v, want 3 each", counts)
	}
}

func TestDeliveryStopsWhenContextIsCancelled(t *testing.T) {
	routes, simulation := newFakeRoutes(), newFakeWriter()
	routes.saved["route-1"] = Route{ID: "route-1", Directions: []Directions{{1, 1}, {2, 2}, {3, 3}}}
	hub := NewEventHub(routes, NewFreightService(), newFakeWriter(), simulation, time.Hour)

	ctx, cancel := context.WithCancel(context.Background())
	if err := hub.HandleEvent(ctx, []byte(`{"event":"DeliveryStarted","route_id":"route-1"}`)); err != nil {
		t.Fatal(err)
	}
	simulation.waitFor(t, 1)
	cancel()

	select {
	case <-simulation.written:
		t.Error("published a point after cancellation")
	case <-time.After(50 * time.Millisecond):
	}
}

func TestDeliveryForUnknownRouteFails(t *testing.T) {
	hub := newHub(newFakeRoutes(), newFakeWriter(), newFakeWriter())

	if err := hub.HandleEvent(context.Background(), []byte(`{"event":"DeliveryStarted","route_id":"nope"}`)); err == nil {
		t.Error("expected an error for an unknown route")
	}
}

func TestInvalidEvents(t *testing.T) {
	hub := newHub(newFakeRoutes(), newFakeWriter(), newFakeWriter())

	for _, msg := range []string{`not json`, `{"event":"Whatever"}`, `{"event":"RouteCreated","distance":1}`} {
		if err := hub.HandleEvent(context.Background(), []byte(msg)); err == nil {
			t.Errorf("HandleEvent(%s) returned no error", msg)
		}
	}
}
