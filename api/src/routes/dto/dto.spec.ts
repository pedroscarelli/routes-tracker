import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateRouteDto } from './create-route.dto';
import { ProcessRouteDto } from './process-route.dto';

const errorsFor = (cls: any, body: object) =>
  validateSync(plainToInstance(cls, body)).map((e) => e.property);

describe('request validation', () => {
  it('accepts a complete route', () => {
    expect(
      errorsFor(CreateRouteDto, {
        name: 'r',
        source_id: 'a',
        destination_id: 'b',
      }),
    ).toEqual([]);
  });

  it('rejects missing or empty fields', () => {
    expect(errorsFor(CreateRouteDto, { name: '', source_id: 'a' })).toEqual([
      'name',
      'destination_id',
    ]);
  });

  it('rejects coordinates out of range', () => {
    expect(errorsFor(ProcessRouteDto, { lat: 91, lng: -181 })).toEqual([
      'lat',
      'lng',
    ]);
    expect(errorsFor(ProcessRouteDto, { lat: -27.1, lng: -49.2 })).toEqual([]);
  });
});
