import { IsLatitude, IsLongitude } from 'class-validator';

export class ProcessRouteDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}
