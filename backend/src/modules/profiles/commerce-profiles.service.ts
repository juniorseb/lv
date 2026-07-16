import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { toGeoPoint } from '../../common/geo/geo.types';
import { UpsertCommerceProfileDto } from './dto/commerce-profile.dto';
import { CommerceProfile } from './entities/commerce-profile.entity';

// Cycle de vie du profil commerce. Un compte n'a qu'un seul profil commerce ;
// l'upsert permet de le compléter progressivement.
@Injectable()
export class CommerceProfilesService {
  constructor(
    @InjectRepository(CommerceProfile)
    private readonly repository: Repository<CommerceProfile>,
  ) {}

  findByUserId(userId: string): Promise<CommerceProfile | null> {
    return this.repository.findOne({ where: { userId } });
  }

  async getByUserIdOrFail(userId: string): Promise<CommerceProfile> {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Aucun profil commerce pour ce compte.');
    }
    return profile;
  }

  // Crée le profil s'il n'existe pas, sinon met à jour les champs fournis.
  async upsert(
    userId: string,
    dto: UpsertCommerceProfileDto,
  ): Promise<CommerceProfile> {
    const location = this.buildLocation(dto);

    let profile = await this.findByUserId(userId);
    if (!profile) {
      profile = this.repository.create({ userId });
    }

    if (dto.shopName !== undefined) {
      profile.shopName = dto.shopName;
    }
    if (dto.defaultAddress !== undefined) {
      profile.defaultAddress = dto.defaultAddress;
    }
    if (location !== undefined) {
      profile.defaultLocation = location;
    }

    return this.repository.save(profile);
  }

  // latitude et longitude doivent être fournies ensemble.
  private buildLocation(dto: UpsertCommerceProfileDto) {
    const hasLat = dto.latitude !== undefined;
    const hasLng = dto.longitude !== undefined;
    if (hasLat !== hasLng) {
      throw new BadRequestException(
        'latitude et longitude doivent être fournies ensemble.',
      );
    }
    if (!hasLat) {
      // Aucune coordonnée fournie : on ne modifie pas la position existante.
      return undefined;
    }
    return toGeoPoint(dto.latitude!, dto.longitude!);
  }
}
