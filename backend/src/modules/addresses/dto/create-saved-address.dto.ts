import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Enregistrement d'une adresse par le client.
export class CreateSavedAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label: string;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  address: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  landmark?: string;
}
