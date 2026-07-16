import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { User } from '../users/entities/user.entity';
import { PublicUser } from '../users/user.view';
import { UsersService } from '../users/users.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { OtpService } from './otp.service';
import { normalizeIvorianPhone } from './utils/phone.util';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
}

export interface AuthResult extends AuthTokens {
  user: PublicUser;
  // true si le compte vient d'être créé : le client peut alors enchaîner sur
  // l'onboarding (selfie + commune, dossier §6 « Niveau 1 »).
  isNewUser: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Étape 1 : demande d'un code OTP pour un numéro donné.
   * Toujours normaliser le numéro en amont pour que « 0700000000 » et
   * « +2250700000000 » désignent bien le même compte.
   */
  async requestOtp(dto: RequestOtpDto): Promise<{
    phoneNumber: string;
    expiresInSeconds: number;
    message: string;
  }> {
    const phoneNumber = normalizeIvorianPhone(dto.phoneNumber);
    const { expiresInSeconds } = await this.otpService.requestOtp(phoneNumber);

    return {
      phoneNumber,
      expiresInSeconds,
      // Ton de marque : simple et direct (dossier §8).
      message: 'On vous a envoyé un code par SMS.',
    };
  }

  /**
   * Étape 2 : vérification du code. Connexion et inscription passent par le même
   * flux — si le compte n'existe pas, il est créé (téléphone vérifié).
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResult> {
    const phoneNumber = normalizeIvorianPhone(dto.phoneNumber);

    await this.otpService.verifyOtp(phoneNumber, dto.code);

    let user = await this.usersService.findByPhoneNumber(phoneNumber);
    let isNewUser = false;

    if (!user) {
      user = await this.usersService.create({
        phoneNumber,
        accountType: dto.accountType,
      });
      isNewUser = true;
      this.logger.log(`Nouveau compte créé pour ${phoneNumber} (${user.id}).`);
    } else if (!user.phoneVerified) {
      // Compte préexistant dont le téléphone n'était pas encore confirmé.
      user = await this.usersService.markPhoneVerified(user);
    }

    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user: await this.usersService.buildPublicUser(user),
      isNewUser,
    };
  }

  /**
   * Échange un refresh token valide contre une nouvelle paire de jetons.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret:
          this.config.get<string>('JWT_REFRESH_SECRET') ??
          'livrechap_dev_refresh_secret',
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Type de jeton invalide.');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Compte introuvable ou désactivé.');
    }

    return this.issueTokens(user);
  }

  // --- Helpers -------------------------------------------------------------

  private async issueTokens(user: User): Promise<AuthTokens> {
    const basePayload = {
      sub: user.id,
      phone: user.phoneNumber,
      accountType: user.accountType,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...basePayload, type: 'access' },
        {
          secret:
            this.config.get<string>('JWT_ACCESS_SECRET') ??
            'livrechap_dev_access_secret',
          expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
        },
      ),
      this.jwtService.signAsync(
        { ...basePayload, type: 'refresh' },
        {
          secret:
            this.config.get<string>('JWT_REFRESH_SECRET') ??
            'livrechap_dev_refresh_secret',
          expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d',
        },
      ),
    ]);

    return { accessToken, refreshToken, tokenType: 'Bearer' };
  }
}
