import { RoutesDriverGateway } from './routes-driver.gateway';

describe('RoutesDriverGateway', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('emits each new point to the route channel and the admin channel', () => {
    const gateway = new RoutesDriverGateway({} as any);
    const emit = jest.fn();
    gateway.server = { emit } as any;

    gateway.emitNewPoints({ route_id: 'r1', lat: 1, lng: 2 });

    expect(emit).toHaveBeenCalledWith('server:new-points/r1:list', {
      route_id: 'r1',
      lat: 1,
      lng: 2,
    });
    expect(emit).toHaveBeenCalledWith('server:new-points:list', {
      route_id: 'r1',
      lat: 1,
      lng: 2,
    });
  });

  it('broadcasts the end of each step, not the start twice', async () => {
    const route = {
      directions: {
        routes: [
          {
            legs: [
              {
                steps: [
                  {
                    start_location: { lat: 1, lng: 1 },
                    end_location: { lat: 2, lng: 2 },
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    const gateway = new RoutesDriverGateway({
      findOne: jest.fn().mockResolvedValue(route),
    } as any);
    const broadcast = jest.fn();
    const client = { emit: jest.fn(), broadcast: { emit: broadcast } };

    const done = gateway.handleMessage(client, { route_id: 'r1' });
    await jest.runAllTimersAsync();
    await done;

    expect(
      broadcast.mock.calls.map(([, point]) => [point.lat, point.lng]),
    ).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(
      client.emit.mock.calls.map(([, point]) => [point.lat, point.lng]),
    ).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });
});
