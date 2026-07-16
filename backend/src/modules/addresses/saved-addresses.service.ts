import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateSavedAddressDto } from './dto/create-saved-address.dto';
import { SavedAddress } from './entities/saved-address.entity';

// Adresses enregistrées du client (spec-app-navigation-roles §3).
@Injectable()
export class SavedAddressesService {
  constructor(
    @InjectRepository(SavedAddress)
    private readonly repository: Repository<SavedAddress>,
  ) {}

  listForUser(userId: string): Promise<SavedAddress[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  create(userId: string, dto: CreateSavedAddressDto): Promise<SavedAddress> {
    const address = this.repository.create({
      userId,
      label: dto.label.trim(),
      address: dto.address.trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      landmark: dto.landmark?.trim() || null,
    });
    return this.repository.save(address);
  }

  async delete(userId: string, id: string): Promise<void> {
    const address = await this.repository.findOne({ where: { id } });
    if (!address) {
      throw new NotFoundException('Adresse introuvable.');
    }
    if (address.userId !== userId) {
      throw new ForbiddenException("Cette adresse n'est pas la vôtre.");
    }
    await this.repository.remove(address);
  }
}
