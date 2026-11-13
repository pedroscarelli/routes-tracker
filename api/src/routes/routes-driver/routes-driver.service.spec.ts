import { NotFoundException } from '@nestjs/common';
import { RoutesDriverService } from './routes-driver.service';

const ROUTE_ID = '674ef78bab1148ea9161c23b';

function setup() {
  const prisma = {
    route: { findUnique: jest.fn() },
    routeDriver: {
      upsert: jest.fn().mockResolvedValue({ route_id: ROUTE_ID }),
    },
  };
  const gateway = { emitNewPoints: jest.fn() };
  const service = new RoutesDriverService(prisma as any, gateway as any);
  return { service, prisma, gateway };
}

describe('RoutesDriverService', () => {
  it('stores the point and pushes it to the WebSocket clients', async () => {
    const { service, prisma, gateway } = setup();
    prisma.route.findUnique.mockResolvedValue({ id: ROUTE_ID });

    await service.processRoute({ route_id: ROUTE_ID, lat: 1, lng: 2 });

    const upsert = prisma.routeDriver.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ route_id: ROUTE_ID });
    expect(upsert.update.points.push.location).toEqual({ lat: 1, lng: 2 });
    expect(gateway.emitNewPoints).toHaveBeenCalledWith({
      route_id: ROUTE_ID,
      lat: 1,
      lng: 2,
    });
  });

  it('rejects points for unknown routes', async () => {
    const { service, prisma, gateway } = setup();
    prisma.route.findUnique.mockResolvedValue(null);

    await expect(
      service.processRoute({ route_id: ROUTE_ID, lat: 1, lng: 2 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.routeDriver.upsert).not.toHaveBeenCalled();
    expect(gateway.emitNewPoints).not.toHaveBeenCalled();
  });

  it('rejects malformed route ids without querying', async () => {
    const { service, prisma } = setup();

    await expect(
      service.processRoute({ route_id: 'abc', lat: 1, lng: 2 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.route.findUnique).not.toHaveBeenCalled();
  });
});
