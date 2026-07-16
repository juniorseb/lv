import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';

// Paramètres de GET /geocoding/reverse. Les query params arrivent en chaîne :
// @Type(() => Number) les convertit (ValidationPipe est en mode transform).
export class ReverseGeocodeDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  lng: number;
}
