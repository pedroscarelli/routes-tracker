import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRouteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  source_id: string;

  @IsString()
  @IsNotEmpty()
  destination_id: string;
}
