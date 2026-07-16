import { IsNumber, Max, Min } from 'class-validator';

// Ping de position d'un livreur (appelé périodiquement en mode Disponible).
export class UpdateLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}
