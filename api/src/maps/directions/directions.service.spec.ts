import { NotFoundException } from '@nestjs/common';
import { DirectionsService } from './directions.service';

const config = { get: jest.fn().mockReturnValue('test-key') };

describe('DirectionsService', () => {
  it('asks Google for a driving route between the two places', async () => {
    const leg = {
      start_location: { lat: 1, lng: 2 },
      end_location: { lat: 3, lng: 4 },
    };
    const client = {
      directions: jest
        .fn()
        .mockResolvedValue({ data: { routes: [{ legs: [leg] }] } }),
    };
    const service = new DirectionsService(client as any, config as any);

    const result = await service.getDirections('a', 'b');

    expect(client.directions.mock.calls[0][0].params).toMatchObject({
      origin: 'place_id:a',
      destination: 'place_id:b',
      mode: 'driving',
      key: 'test-key',
    });
    expect(result.request.origin.location).toEqual({ lat: 1, lng: 2 });
    expect(result.request.destination.location).toEqual({ lat: 3, lng: 4 });
  });

  it('returns 404 when Google finds no route instead of crashing', async () => {
    const client = {
      directions: jest
        .fn()
        .mockResolvedValue({ data: { status: 'ZERO_RESULTS', routes: [] } }),
    };
    const service = new DirectionsService(client as any, config as any);

    await expect(service.getDirections('a', 'b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
