import { RoutesConsumer } from './routes.consumer';

describe('RoutesConsumer', () => {
  it('stores the freight calculated by the simulator', async () => {
    const routesService = { update: jest.fn().mockResolvedValue({}) };
    const consumer = new RoutesConsumer(routesService as any);

    await consumer.updateFreight({
      topic: 'freight',
      messageValue: { route_id: 'r1', amount: 18.3 },
    } as any);

    expect(routesService.update).toHaveBeenCalledWith('r1', { freight: 18.3 });
  });
});
