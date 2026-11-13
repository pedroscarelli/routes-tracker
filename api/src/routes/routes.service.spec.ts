import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RoutesService } from './routes.service';

const ROUTE_ID = '674ef78bab1148ea9161c23b';

const leg = {
  start_address: 'Start St',
  end_address: 'End Ave',
  start_location: { lat: 1, lng: 2 },
  end_location: { lat: 5, lng: 6 },
  duration: { value: 600 },
  distance: { value: 1200 },
  steps: [
    { start_location: { lat: 1, lng: 2 }, end_location: { lat: 3, lng: 4 } },
    { start_location: { lat: 3, lng: 4 }, end_location: { lat: 5, lng: 6 } },
  ],
};

function setup() {
  const prisma = {
    route: {
      create: jest
        .fn()
        .mockImplementation(({ data }) => ({ id: ROUTE_ID, ...data })),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const directions = {
    getDirections: jest.fn().mockResolvedValue({
      available_travel_modes: [],
      geocoded_waypoints: [],
      routes: [{ legs: [leg] }],
      request: {},
    }),
  };
  const producer = { send: jest.fn().mockResolvedValue(undefined) };
  const service = new RoutesService(
    prisma as any,
    directions as any,
    producer as any,
  );
  return { service, prisma, directions, producer };
}

function sentEvent(producer: { send: jest.Mock }) {
  const { topic, messages } = producer.send.mock.calls[0][0];
  return { topic, event: JSON.parse(messages[0].value) };
}

describe('RoutesService', () => {
  it('saves the route and publishes RouteCreated with every step point', async () => {
    const { service, prisma, directions, producer } = setup();

    const route = await service.create({
      name: 'Route 1',
      source_id: 'place-a',
      destination_id: 'place-b',
    });

    expect(directions.getDirections).toHaveBeenCalledWith('place-a', 'place-b');
    expect(prisma.route.create.mock.calls[0][0].data).toMatchObject({
      name: 'Route 1',
      source: { name: 'Start St', location: { lat: 1, lng: 2 } },
      destination: { name: 'End Ave', location: { lat: 5, lng: 6 } },
      distance: 1200,
      duration: 600,
    });
    expect(route.id).toBe(ROUTE_ID);

    const { topic, event } = sentEvent(producer);
    expect(topic).toBe('route');
    expect(event).toEqual({
      event: 'RouteCreated',
      id: ROUTE_ID,
      distance: 1200,
      directions: [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
        { lat: 3, lng: 4 },
        { lat: 5, lng: 6 },
      ],
    });
  });

  it('publishes DeliveryStarted for an existing route', async () => {
    const { service, prisma, producer } = setup();
    prisma.route.findUnique.mockResolvedValue({ id: ROUTE_ID });

    await service.startRoute(ROUTE_ID);

    expect(sentEvent(producer)).toEqual({
      topic: 'route',
      event: { event: 'DeliveryStarted', route_id: ROUTE_ID },
    });
  });

  it('does not start a route that does not exist', async () => {
    const { service, prisma, producer } = setup();
    prisma.route.findUnique.mockResolvedValue(null);

    await expect(service.startRoute(ROUTE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(producer.send).not.toHaveBeenCalled();
  });

  it('returns 404 instead of a database error for malformed ids', async () => {
    const { service, prisma } = setup();

    await expect(service.findOne('not-an-object-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.route.findUnique).not.toHaveBeenCalled();
  });

  it('maps a missing route on update to 404', async () => {
    const { service, prisma } = setup();
    prisma.route.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.update(ROUTE_ID, { freight: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
