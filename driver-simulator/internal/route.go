package internal

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Directions struct {
	Lat float64 `bson:"lat" json:"lat"`
	Lng float64 `bson:"lng" json:"lng"`
}

type Route struct {
	ID           string       `bson:"_id" json:"id"`
	Distance     int          `bson:"distance" json:"distance"`
	Directions   []Directions `bson:"directions" json:"directions"`
	FreightPrice float64      `bson:"freight_price" json:"freight_price"`
}

func NewRoute(id string, distance int, directions []Directions) Route {
	return Route{
		ID:         id,
		Distance:   distance,
		Directions: directions,
	}
}

// RouteRepository stores the routes the simulator knows about.
type RouteRepository interface {
	SaveRoute(ctx context.Context, route Route) error
	GetRoute(ctx context.Context, id string) (Route, error)
}

type FreightService struct{}

func NewFreightService() *FreightService {
	return &FreightService{}
}

// Calculate returns 0.15 per distance unit plus a 0.30 base fee.
// The math is done in cents so the result never loses a cent to float rounding.
func (fs *FreightService) Calculate(distance int) float64 {
	cents := distance*15 + 30
	return float64(cents) / 100
}

type MongoRouteRepository struct {
	collection *mongo.Collection
}

func NewMongoRouteRepository(client *mongo.Client) *MongoRouteRepository {
	return &MongoRouteRepository{collection: client.Database("routes").Collection("routes")}
}

func (r *MongoRouteRepository) SaveRoute(ctx context.Context, route Route) error {
	update := bson.M{
		"$set": bson.M{
			"distance":      route.Distance,
			"directions":    route.Directions,
			"freight_price": route.FreightPrice,
		},
	}
	// upsert, so a repeated RouteCreated event just overwrites the route
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": route.ID}, update, options.Update().SetUpsert(true))
	return err
}

func (r *MongoRouteRepository) GetRoute(ctx context.Context, id string) (Route, error) {
	var route Route
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&route)
	return route, err
}
