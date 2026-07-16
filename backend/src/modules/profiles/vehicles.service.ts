import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DriverProfilesService } from './driver-profiles.service';
import { UpsertVehicleDto } from './dto/vehicle.dto';
import { DriverProfile } from './entities/driver-profile.entity';
import { Vehicle } from './entities/vehicle.entity';

// Gestion du véhicule du livreur : un véhicule actif par livreur en V1 (le
// multi-véhicules est prévu pour plus tard). Le type reste synchronisé avec
// driver_profiles, qui pilote le matching.
@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly repository: Repository<Vehicle>,
    private readonly driverProfiles: DriverProfilesService,
  ) {}

  getActiveForDriver(driverId: string): Promise<Vehicle | null> {
    return this.repository.findOne({
      where: { driverId, isActive: true },
    });
  }

  // Tous les véhicules du livreur, l'actif d'abord puis les plus récents (P2).
  async listForUser(userId: string): Promise<Vehicle[]> {
    const driver = await this.driverProfiles.getByUserIdOrFail(userId);
    return this.repository.find({
      where: { driverId: driver.id },
      order: { isActive: 'DESC', createdAt: 'DESC' },
    });
  }

  // Ajout d'un véhicule supplémentaire, activé aussitôt (P2).
  async addForUser(userId: string, dto: UpsertVehicleDto): Promise<Vehicle> {
    const driver = await this.driverProfiles.getByUserIdOrFail(userId);
    const vehicle = this.repository.create({
      driverId: driver.id,
      vehicleType: dto.vehicleType,
      marque: dto.marque ?? null,
      modele: dto.modele ?? null,
      annee: dto.annee ?? null,
      couleur: dto.couleur ?? null,
      immatriculation: dto.immatriculation ?? null,
      photoAvantUrl: dto.photoAvantUrl ?? null,
      photoArriereUrl: dto.photoArriereUrl ?? null,
      photoPlaqueUrl: dto.photoPlaqueUrl ?? null,
      capaciteMaxColis: dto.capaciteMaxColis ?? null,
      capacitePoidsKg: dto.capacitePoidsKg ?? null,
      isActive: true,
    });
    const saved = await this.repository.save(vehicle);
    await this.makeActive(driver, saved);
    return saved;
  }

  // Bascule le véhicule actif du livreur (P2).
  async activateForUser(userId: string, vehicleId: string): Promise<Vehicle> {
    const driver = await this.driverProfiles.getByUserIdOrFail(userId);
    const vehicle = await this.ownedVehicle(driver.id, vehicleId);
    await this.makeActive(driver, vehicle);
    vehicle.isActive = true;
    return vehicle;
  }

  // Suppression d'un véhicule ; si c'était l'actif, on active le plus récent
  // restant (P2).
  async deleteForUser(userId: string, vehicleId: string): Promise<void> {
    const driver = await this.driverProfiles.getByUserIdOrFail(userId);
    const vehicle = await this.ownedVehicle(driver.id, vehicleId);
    await this.repository.remove(vehicle);
    if (vehicle.isActive) {
      const next = await this.repository.findOne({
        where: { driverId: driver.id },
        order: { createdAt: 'DESC' },
      });
      if (next) {
        await this.makeActive(driver, next);
      }
    }
  }

  private async ownedVehicle(
    driverId: string,
    vehicleId: string,
  ): Promise<Vehicle> {
    const vehicle = await this.repository.findOne({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException('Véhicule introuvable.');
    }
    if (vehicle.driverId !== driverId) {
      throw new ForbiddenException("Ce véhicule n'est pas le vôtre.");
    }
    return vehicle;
  }

  // Rend un véhicule actif (désactive les autres) et synchronise le type du
  // profil livreur (source du matching).
  private async makeActive(
    driver: DriverProfile,
    vehicle: Vehicle,
  ): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(Vehicle)
      .set({ isActive: false })
      .where('driver_id = :driverId AND id != :id', {
        driverId: driver.id,
        id: vehicle.id,
      })
      .execute();
    if (!vehicle.isActive) {
      vehicle.isActive = true;
      await this.repository.save(vehicle);
    }
    if (driver.vehicleType !== vehicle.vehicleType) {
      await this.driverProfiles.updateVehicleType(driver.userId, {
        vehicleType: vehicle.vehicleType,
      });
    }
  }

  getForUser(userId: string): Promise<Vehicle | null> {
    return this.driverProfiles
      .getByUserIdOrFail(userId)
      .then((driver) => this.getActiveForDriver(driver.id));
  }

  // Création ou mise à jour du véhicule actif du livreur connecté. Met aussi à
  // jour le type de véhicule du profil (source du matching).
  async upsertForUser(
    userId: string,
    dto: UpsertVehicleDto,
  ): Promise<Vehicle> {
    const driver = await this.driverProfiles.getByUserIdOrFail(userId);
    if (driver.vehicleType !== dto.vehicleType) {
      await this.driverProfiles.updateVehicleType(userId, {
        vehicleType: dto.vehicleType,
      });
    }

    const existing = await this.getActiveForDriver(driver.id);
    const target = existing ?? this.repository.create({ driverId: driver.id });

    target.vehicleType = dto.vehicleType;
    target.marque = dto.marque ?? null;
    target.modele = dto.modele ?? null;
    target.annee = dto.annee ?? null;
    target.couleur = dto.couleur ?? null;
    target.immatriculation = dto.immatriculation ?? null;
    if (dto.photoAvantUrl !== undefined) target.photoAvantUrl = dto.photoAvantUrl;
    if (dto.photoArriereUrl !== undefined)
      target.photoArriereUrl = dto.photoArriereUrl;
    if (dto.photoPlaqueUrl !== undefined)
      target.photoPlaqueUrl = dto.photoPlaqueUrl;
    target.capaciteMaxColis = dto.capaciteMaxColis ?? null;
    target.capacitePoidsKg = dto.capacitePoidsKg ?? null;
    target.isActive = true;

    return this.repository.save(target);
  }
}
