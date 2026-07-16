import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// Un article à remettre au destinataire (spec-delivery-items). Sans prix.
export class DeliveryItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}

// Un arrêt de la tournée : un destinataire, une adresse, un prix.
export class TourStopDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  recipientPhone?: string;

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

  @IsInt()
  @Min(0)
  priceFcfa: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  packageDescription?: string;

  // Détail des articles à remettre (spec-delivery-items).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => DeliveryItemDto)
  items?: DeliveryItemDto[];
}

// Création d'une tournée (spec-delivery-architecture-tournees §1.2) : un point de
// départ (collecte chez le vendeur) + plusieurs arrêts. Type `batch`.
export class CreateTourDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  departAddress: string;

  @IsLatitude()
  departLatitude: number;

  @IsLongitude()
  departLongitude: number;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TourStopDto)
  stops: TourStopDto[];
}
