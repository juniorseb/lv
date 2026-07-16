import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  DELIVERY_PACKAGE_TYPES,
  DeliveryUrgency,
  MatchingMode,
  PackageType,
} from '../entities/delivery.entity';

const URGENCIES: DeliveryUrgency[] = ['normal', 'urgent', 'express'];

// Un point de la livraison : adresse lisible + coordonnées.
export class DeliveryLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

// Publication d'une livraison (« Trouver un livreur », dossier §4).
export class CreateDeliveryDto {
  @ValidateNested()
  @Type(() => DeliveryLocationDto)
  pickup: DeliveryLocationDto;

  @ValidateNested()
  @Type(() => DeliveryLocationDto)
  dropoff: DeliveryLocationDto;

  // Prix proposé en FCFA. Le plancher de prix réel est une décision produit
  // (message « augmentez de 200 FCFA… » côté matching) ; on impose juste un
  // montant strictement positif ici.
  @IsInt()
  @Min(1)
  priceFcfa: number;

  @IsOptional()
  @IsIn(DELIVERY_PACKAGE_TYPES)
  packageType?: PackageType;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  recipientPhone?: string;

  // Contact au point de récupération (celui qui remet le colis). Optionnel :
  // par défaut c'est l'expéditeur, mais il peut commander pour quelqu'un d'autre.
  @IsOptional()
  @IsString()
  @MaxLength(150)
  pickupContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pickupContactPhone?: string;

  // Repère du livreur pour chaque adresse (« portail orange, après la pharmacie »).
  @IsOptional()
  @IsString()
  @MaxLength(150)
  pickupNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  dropoffNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  // require_tld: false pour accepter les URLs du stockage local (localhost).
  @IsUrl({ require_protocol: true, require_tld: false })
  photoUrl?: string;

  @IsOptional()
  @IsIn(['rapide', 'choix'])
  matchingMode?: MatchingMode;

  @IsOptional()
  @IsIn(URGENCIES)
  urgency?: DeliveryUrgency;

  // Date/heure programmée au format ISO 8601. Tant qu'elle est future, la course
  // n'est pas proposée aux livreurs.
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  // Paiement à la réception (COD) : montant de l'article à collecter en plus des
  // frais de livraison.
  @IsOptional()
  @IsBoolean()
  isCod?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  codArticleAmountFcfa?: number;
}
