# Vehicle tracking system

Create delivery routes on Google Maps, start a trip, and watch the vehicle move on the map in real time.
Built during the Full Cycle Immersion 20 week.

## How it works

```
Next.js UI ──HTTP──▶ Nest API ──▶ MongoDB
     ▲                  │
     │ WebSocket        │ Kafka "route" topic: RouteCreated, DeliveryStarted
     │                  ▼
Nest API ◀── Kafka ── Go simulator
           "freight": calculated freight price
           "simulation": one DriverMoved event per point of the route
```

| Folder | What it is |
|---|---|
| `api/` | NestJS + Prisma (MongoDB). REST API, Google Maps Places/Directions, Kafka producer and consumer, Socket.IO gateway |
| `driver-simulator/` | Go service. Calculates the freight and simulates the driver by publishing the route's points, one per second |
| `ui/` | Next.js 15 (App Router, server actions). Pages to create routes, start a trip and follow every vehicle |
| `kafka/`, `mongodb/` | Infrastructure for local development |

## Requirements

- Docker and Docker Compose
- A Google Maps API key with the Places, Directions and Maps JavaScript APIs enabled (step by step in [api/README.md](api/README.md))

## Running the application

```bash
cp .env.example .env   # then put your Google Maps API key in it
docker compose up -d
```

The first start installs the Node dependencies inside the containers, so give it a minute or two.

- Register new routes: http://localhost:3001/new-route
- Start a route: http://localhost:3001/driver
- Admin page to follow every started route: http://localhost:3001/admin
- Kafka Control Center: http://localhost:9021

## Running the tests

```bash
cd api && npm install && npm test
cd driver-simulator && go test -race ./...
cd ui && npm install && npm run lint && npm run build
```

## References

Full Cycle Immersion: https://imersao.fullcycle.com.br/ · Original project: https://github.com/devfullcycle/imersao20/
