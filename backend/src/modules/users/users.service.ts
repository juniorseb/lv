import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { DriverProfilesService } from '../profiles/driver-profiles.service';
import {
  AccountType,
  IdDocumentType,
  User,
  UserRole,
  VerificationLevel,
} from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PublicUser, toPublicUser } from './user.view';

// Données minimales de création d'un compte au moment de la vérification OTP.
// Le reste du profil (selfie, commune, nom, CNI) est complété plus tard
// via les modules users/profiles — cf. parcours d'onboarding du dossier §6.
export interface CreateUserInput {
  phoneNumber: string;
  accountType?: AccountType;
  fullName?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly driverProfiles: DriverProfilesService,
  ) {}

  // Vue publique enrichie : indique si le compte a un profil livreur (rôles) —
  // source de vérité pour la navigation côté app (spec-app-navigation-roles).
  async buildPublicUser(user: User): Promise<PublicUser> {
    const driver = await this.driverProfiles.findByUserId(user.id);
    return toPublicUser(user, Boolean(driver));
  }

  // Rôle affiché au lancement de l'app. Passer en « livreur » exige un profil
  // livreur (onboarding fait).
  async setActiveRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.getByIdOrFail(userId);
    if (role === 'livreur') {
      const driver = await this.driverProfiles.findByUserId(userId);
      if (!driver) {
        throw new BadRequestException(
          "Terminez d'abord votre inscription livreur.",
        );
      }
    }
    user.activeRole = role;
    return this.usersRepository.save(user);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phoneNumber } });
  }

  // Comptes administrateurs (pour notifier le support, ex. alerte Protect).
  listAdmins(): Promise<User[]> {
    return this.usersRepository.find({ where: { isAdmin: true } });
  }

  async create(input: CreateUserInput): Promise<User> {
    const user = this.usersRepository.create({
      phoneNumber: input.phoneNumber,
      accountType: input.accountType ?? 'particulier',
      fullName: input.fullName ?? null,
      // Le compte n'est créé qu'après une vérification OTP réussie :
      // le téléphone est donc vérifié dès la création.
      phoneVerified: true,
    });
    return this.usersRepository.save(user);
  }

  async markPhoneVerified(user: User): Promise<User> {
    if (user.phoneVerified) {
      return user;
    }
    user.phoneVerified = true;
    return this.usersRepository.save(user);
  }

  // Charge un utilisateur ou lève 404 — pratique dans les flux authentifiés
  // où l'existence est attendue.
  async getByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    return user;
  }

  // Complétion du profil : nom, commune, email, date de naissance.
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.getByIdOrFail(userId);
    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName;
    }
    if (dto.commune !== undefined) {
      user.commune = dto.commune;
    }
    if (dto.email !== undefined) {
      user.email = dto.email;
    }
    if (dto.dateNaissance !== undefined) {
      user.dateNaissance = dto.dateNaissance;
    }
    if (dto.emergencyContactName !== undefined) {
      user.emergencyContactName = dto.emergencyContactName;
    }
    if (dto.emergencyContactPhone !== undefined) {
      user.emergencyContactPhone = dto.emergencyContactPhone;
    }
    return this.usersRepository.save(user);
  }

  // Enregistre l'URL du selfie (Niveau 1).
  async setSelfie(userId: string, selfieUrl: string): Promise<User> {
    const user = await this.getByIdOrFail(userId);
    user.selfieUrl = selfieUrl;
    return this.usersRepository.save(user);
  }

  // Enregistre la pièce d'identité soumise (CNI ou passeport). Ne fait PAS
  // passer au Niveau 2 : la validation reste manuelle (admin).
  async submitIdDocument(
    userId: string,
    documentUrl: string,
    documentType: IdDocumentType,
  ): Promise<User> {
    const user = await this.getByIdOrFail(userId);
    user.idDocumentUrl = documentUrl;
    user.idDocumentType = documentType;
    return this.usersRepository.save(user);
  }

  // Bascule particulier ↔ commerce.
  async updateAccountType(userId: string, accountType: AccountType): Promise<User> {
    const user = await this.getByIdOrFail(userId);
    user.accountType = accountType;
    return this.usersRepository.save(user);
  }

  // --- Back-office (validation par palier, dossier §6) ---------------------

  // Comptes ayant soumis une pièce d'identité mais pas encore validés
  // (Niveau 2 en attente).
  listPendingIdVerifications(): Promise<User[]> {
    return this.usersRepository.find({
      where: { idDocumentUrl: Not(IsNull()), verificationLevel: 'standard' },
      order: { createdAt: 'ASC' },
    });
  }

  async setVerificationLevel(
    userId: string,
    level: VerificationLevel,
  ): Promise<User> {
    const user = await this.getByIdOrFail(userId);
    user.verificationLevel = level;
    return this.usersRepository.save(user);
  }

  // Rejet d'une pièce : on l'efface pour permettre une nouvelle soumission ;
  // le niveau reste « standard ».
  async clearIdDocument(userId: string): Promise<User> {
    const user = await this.getByIdOrFail(userId);
    user.idDocumentUrl = null;
    user.idDocumentType = null;
    return this.usersRepository.save(user);
  }
}
