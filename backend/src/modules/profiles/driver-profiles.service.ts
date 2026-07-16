import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GeoPoint } from '../../common/geo/geo.types';
import {
  CreateDriverProfileDto,
  UpdateDriverProfileDto,
} from './dto/driver-profile.dto';
import {
  DriverProfile,
  DriverStatus,
  MobileMoneyOperator,
} from './entities/driver-profile.entity';

// Cycle de vie du profil livreur (identité du rôle). Les opérations « runtime »
// du livreur — passage en mode Disponible, actualisation de la position, feed de
// missions — relèveront du module drivers/matching (étapes suivantes du README).
@Injectable()
export class DriverProfilesService {
  constructor(
    @InjectRepository(DriverProfile)
    private readonly repository: Repository<DriverProfile>,
  ) {}

  findByUserId(userId: string): Promise<DriverProfile | null> {
    return this.repository.findOne({ where: { userId } });
  }

  findById(id: string): Promise<DriverProfile | null> {
    return this.repository.findOne({ where: { id } });
  }

  async getByUserIdOrFail(userId: string): Promise<DriverProfile> {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException("Aucun profil livreur pour ce compte.");
    }
    return profile;
  }

  // Activation du rôle livreur. Un compte n'a qu'un seul profil livreur.
  async create(
    userId: string,
    dto: CreateDriverProfileDto,
  ): Promise<DriverProfile> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      throw new ConflictException('Un profil livreur existe déjà pour ce compte.');
    }
    const profile = this.repository.create({
      userId,
      vehicleType: dto.vehicleType,
      // Nouveau livreur : en attente de validation admin, aucune mission tant
      // que le statut n'est pas « actif » (spec-onboarding-livreur-v2 §4).
      status: 'en_validation',
      zones: normalizeZones(dto.zones),
    });
    return this.repository.save(profile);
  }

  // Décision de l'admin : activation ou suspension du livreur.
  async setStatus(
    driverId: string,
    status: DriverStatus,
  ): Promise<DriverProfile> {
    const profile = await this.findById(driverId);
    if (!profile) {
      throw new NotFoundException('Profil livreur introuvable.');
    }
    profile.status = status;
    // Un livreur suspendu ne doit plus apparaître comme disponible.
    if (status !== 'actif') {
      profile.isAvailable = false;
    }
    return this.repository.save(profile);
  }

  async updateVehicleType(
    userId: string,
    dto: UpdateDriverProfileDto,
  ): Promise<DriverProfile> {
    const profile = await this.getByUserIdOrFail(userId);
    profile.vehicleType = dto.vehicleType;
    return this.repository.save(profile);
  }

  // Compte mobile money servant à alimenter/recharger la caution (spec §1
  // étape 5). Ce n'est pas un compte de réception : Livrechap ne verse rien.
  async setMobileMoney(
    userId: string,
    operator: MobileMoneyOperator,
    numberMsisdn: string,
    holder: string,
  ): Promise<DriverProfile> {
    const profile = await this.getByUserIdOrFail(userId);
    profile.mobileMoneyOperator = operator;
    profile.mobileMoneyNumber = numberMsisdn;
    profile.mobileMoneyHolder = holder;
    return this.repository.save(profile);
  }

  // Passage en mode Disponible / Indisponible. Une position peut être fournie
  // au moment de l'activation (dossier §4 : « Mode Disponible »).
  async setAvailability(
    userId: string,
    isAvailable: boolean,
    point?: GeoPoint,
  ): Promise<DriverProfile> {
    const profile = await this.getByUserIdOrFail(userId);
    profile.isAvailable = isAvailable;
    if (point) {
      profile.currentLocation = point;
      profile.locationUpdatedAt = new Date();
    }
    return this.repository.save(profile);
  }

  // Actualisation périodique de la position (pas en continu, pour préserver
  // batterie et confidentialité — dossier §4).
  async updateLocation(userId: string, point: GeoPoint): Promise<DriverProfile> {
    const profile = await this.getByUserIdOrFail(userId);
    profile.currentLocation = point;
    profile.locationUpdatedAt = new Date();
    return this.repository.save(profile);
  }
}

// Nettoie la liste des zones : trim, retrait des vides/doublons, stockage en
// chaîne séparée par des virgules (null si vide).
function normalizeZones(zones?: string[]): string | null {
  if (!zones || zones.length === 0) {
    return null;
  }
  const cleaned = Array.from(
    new Set(zones.map((z) => z.trim()).filter((z) => z.length > 0)),
  );
  return cleaned.length > 0 ? cleaned.join(', ') : null;
}
