import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

// Bascule Disponible / Indisponible. Lors du passage en disponible, une position
// peut être fournie ; si elle est absente, la dernière position connue est
// réutilisée (sinon la position est exigée côté service).
export class SetAvailabilityDto {
  @IsBoolean()
  isAvailable: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
