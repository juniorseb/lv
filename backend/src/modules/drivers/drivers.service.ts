import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { geoPointLatitude, geoPointLongitude, GeoPoint, toGeoPoint } from '../../common/geo/geo.types';
import { DriverProfile } from '../profiles/entities/driver-profile.entity';
import { DriverProfilesService } from '../profiles/driver-profiles.service';
import { VehiclesService } from '../profiles/vehicles.service';
import {
  DriverPublicView,
  toDriverPublicView,
} from '../profiles/profile.view';
import { DriverPresenceCache } from '../matching/driver-presence.cache';
import { UsersService } from '../users/users.service';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

// Opérations « runtime » du livreur : disponibilité et position. Ces mises à
// jour alimentent le moteur de matching. La persistance (PostGIS, source de
// vérité) passe par DriverProfilesService ; le cache de présence Redis GEO
// (chemin rapide du compteur live) est synchronisé en parallèle.
@Injectable()
export class DriversService {
  constructor(
    private readonly driverProfiles: DriverProfilesService,
    private readonly vehicles: VehiclesService,
    private readonly users: UsersService,
    private readonly presence: DriverPresenceCache,
  ) {}

  // Profil public d'un livreur (P2), visible par les clients. Aucune donnée
  // sensible : prénom, photo, note, ancienneté, badges de confiance.
  async getPublicProfile(driverId: string): Promise<DriverPublicView> {
    const driver = await this.driverProfiles.findById(driverId);
    if (!driver) {
      throw new NotFoundException('Livreur introuvable.');
    }
    const [user, vehicle] = await Promise.all([
      this.users.findById(driver.userId),
      this.vehicles.getActiveForDriver(driver.id),
    ]);
    return toDriverPublicView(driver, {
      fullName: user?.fullName ?? null,
      selfieUrl: user?.selfieUrl ?? null,
      verificationLevel: user?.verificationLevel ?? 'standard',
      createdAt: driver.createdAt,
      vehicle,
    });
  }

  async setAvailability(
    userId: string,
    dto: SetAvailabilityDto,
  ): Promise<DriverProfile> {
    const profile = await this.driverProfiles.getByUserIdOrFail(userId);

    // Un livreur non validé (ou suspendu) ne peut pas se rendre disponible
    // (spec-onboarding-livreur-v2 §4).
    if (dto.isAvailable && profile.status !== 'actif') {
      throw new BadRequestException(
        profile.status === 'suspendu'
          ? 'Votre compte livreur est suspendu.'
          : 'Votre compte est en cours de validation. Vous recevrez une notification dès son activation.',
      );
    }

    if (!dto.isAvailable) {
      const updated = await this.driverProfiles.setAvailability(userId, false);
      await this.presence.remove(profile.id);
      return updated;
    }

    // Passage en disponible : position fournie, sinon dernière position connue.
    const point = this.resolvePoint(dto, profile.currentLocation);
    if (!point) {
      throw new BadRequestException(
        'Position requise pour passer en mode disponible.',
      );
    }

    const updated = await this.driverProfiles.setAvailability(userId, true, point);
    await this.presence.setAvailable(
      updated.id,
      geoPointLatitude(point),
      geoPointLongitude(point),
    );
    return updated;
  }

  async updateLocation(
    userId: string,
    dto: UpdateLocationDto,
  ): Promise<DriverProfile> {
    const point = toGeoPoint(dto.latitude, dto.longitude);
    const updated = await this.driverProfiles.updateLocation(userId, point);

    // Le cache de présence n'a de sens que si le livreur est disponible.
    if (updated.isAvailable) {
      await this.presence.setAvailable(updated.id, dto.latitude, dto.longitude);
    }
    return updated;
  }

  private resolvePoint(
    dto: SetAvailabilityDto,
    fallback: GeoPoint | null,
  ): GeoPoint | null {
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      return toGeoPoint(dto.latitude, dto.longitude);
    }
    return fallback;
  }
}
