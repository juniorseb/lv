import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DriverProfilesService } from './driver-profiles.service';
import { VehicleType } from './entities/driver-profile.entity';
import {
  DriverDocument,
  DriverDocumentStatus,
  DriverDocumentType,
} from './entities/driver-document.entity';

const COMMON_DOCUMENTS: DriverDocumentType[] = [
  'cni_recto',
  'cni_verso',
  'selfie_live',
];

// Documents obligatoires selon le véhicule (spec-onboarding-livreur-v2 §1
// étape 4). Source de vérité partagée entre l'app livreur et le garde-fou
// d'activation admin.
export function requiredDocumentTypes(
  vehicleType: VehicleType,
): DriverDocumentType[] {
  if (vehicleType === 'moto') {
    return [...COMMON_DOCUMENTS, 'permis'];
  }
  if (vehicleType === 'voiture' || vehicleType === 'camionnette') {
    return [
      ...COMMON_DOCUMENTS,
      'permis',
      'carte_grise',
      'assurance',
      'visite_technique',
    ];
  }
  return COMMON_DOCUMENTS; // vélo, à pied
}

export const DOCUMENT_LABELS: Record<DriverDocumentType, string> = {
  cni_recto: "Pièce d'identité (recto)",
  cni_verso: "Pièce d'identité (verso)",
  selfie_live: 'Selfie',
  permis: 'Permis de conduire',
  carte_grise: 'Carte grise',
  assurance: 'Assurance',
  visite_technique: 'Visite technique',
};

// Gestion des documents du livreur : un document courant par type (le nouvel
// envoi remplace le précédent et repasse « en_attente »).
@Injectable()
export class DriverDocumentsService {
  constructor(
    @InjectRepository(DriverDocument)
    private readonly repository: Repository<DriverDocument>,
    private readonly driverProfiles: DriverProfilesService,
  ) {}

  listForDriver(driverId: string): Promise<DriverDocument[]> {
    return this.repository.find({
      where: { driverId },
      order: { typeDocument: 'ASC' },
    });
  }

  // Documents requis encore non validés, pour le garde-fou d'activation.
  async missingValidatedDocuments(
    driverId: string,
    vehicleType: VehicleType,
  ): Promise<string[]> {
    const docs = await this.listForDriver(driverId);
    const validated = new Set(
      docs.filter((d) => d.status === 'valide').map((d) => d.typeDocument),
    );
    return requiredDocumentTypes(vehicleType)
      .filter((type) => !validated.has(type))
      .map((type) => DOCUMENT_LABELS[type]);
  }

  // Documents d'un livreur via son compte utilisateur.
  async listForUser(userId: string): Promise<DriverDocument[]> {
    const driver = await this.driverProfiles.getByUserIdOrFail(userId);
    return this.listForDriver(driver.id);
  }

  // Envoi/remplacement d'un document par le livreur connecté.
  async submitForUser(
    userId: string,
    type: DriverDocumentType,
    url: string,
    dateExpiration?: string,
  ): Promise<DriverDocument> {
    const driver = await this.driverProfiles.getByUserIdOrFail(userId);
    const existing = await this.repository.findOne({
      where: { driverId: driver.id, typeDocument: type },
    });
    if (existing) {
      existing.url = url;
      existing.status = 'en_attente';
      existing.dateExpiration = dateExpiration ?? null;
      return this.repository.save(existing);
    }
    const doc = this.repository.create({
      driverId: driver.id,
      typeDocument: type,
      url,
      status: 'en_attente',
      dateExpiration: dateExpiration ?? null,
    });
    return this.repository.save(doc);
  }

  // Revue d'un document par l'admin.
  async setStatus(
    documentId: string,
    status: DriverDocumentStatus,
  ): Promise<DriverDocument> {
    const doc = await this.repository.findOne({ where: { id: documentId } });
    if (!doc) {
      throw new NotFoundException('Document introuvable.');
    }
    doc.status = status;
    return this.repository.save(doc);
  }
}
