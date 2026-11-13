import { PlacesService } from './places.service';

describe('PlacesService', () => {
  it('searches places by text with the configured key', async () => {
    const client = {
      findPlaceFromText: jest
        .fn()
        .mockResolvedValue({ data: { candidates: [] } }),
    };
    const service = new PlacesService(
      client as any,
      { get: () => 'test-key' } as any,
    );

    const result = await service.findPlaces('main street');

    expect(result).toEqual({ candidates: [] });
    expect(client.findPlaceFromText.mock.calls[0][0].params).toMatchObject({
      input: 'main street',
      inputtype: 'textquery',
      key: 'test-key',
    });
  });
});
