import { createHmac, randomInt, timingSafeEqual } from 'crypto';

import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import { SmsService } from './sms.service';

// Gestion des codes OTP à usage unique.
//
// Choix de sécurité :
//  - le code n'est JAMAIS stocké en clair : seul un HMAC-SHA256 (avec poivre)
//    est conservé dans Redis, avec une expiration courte (OTP_TTL_SECONDS) ;
//  - anti-abus à trois niveaux :
//      1. délai minimal entre deux envois (OTP_RESEND_COOLDOWN_SECONDS) ;
//      2. plafond d'envois par heure et par numéro (OTP_MAX_SENDS_PER_HOUR) ;
//      3. plafond de tentatives de vérification (OTP_MAX_ATTEMPTS) avant
//         invalidation du code, pour empêcher le brute-force.
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  private readonly length: number;
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;
  private readonly resendCooldownSeconds: number;
  private readonly maxSendsPerHour: number;
  private readonly pepper: string;
  // Code de contournement pour le développement uniquement : accepté pour
  // n'importe quel numéro afin de faciliter les tests. Toujours désactivé si
  // NODE_ENV=production, quelle que soit la valeur de l'env.
  private readonly devBypassCode?: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly smsService: SmsService,
  ) {
    this.length = this.config.get<number>('OTP_LENGTH') ?? 6;
    this.ttlSeconds = this.config.get<number>('OTP_TTL_SECONDS') ?? 300;
    this.maxAttempts = this.config.get<number>('OTP_MAX_ATTEMPTS') ?? 5;
    this.resendCooldownSeconds =
      this.config.get<number>('OTP_RESEND_COOLDOWN_SECONDS') ?? 60;
    this.maxSendsPerHour = this.config.get<number>('OTP_MAX_SENDS_PER_HOUR') ?? 5;
    this.pepper = this.config.get<string>('OTP_PEPPER') ?? 'livrechap_dev_pepper';

    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const bypass = this.config.get<string>('OTP_DEV_BYPASS_CODE');
    this.devBypassCode = !isProduction && bypass ? bypass : undefined;
    if (this.devBypassCode) {
      this.logger.warn(
        `⚠️ Code OTP de développement ACTIF (${this.devBypassCode}) — accepté pour tout numéro. À NE JAMAIS activer en production.`,
      );
    }
  }

  /**
   * Génère un code, le stocke haché avec TTL, et l'envoie par SMS.
   * Applique le cooldown et le plafond horaire.
   * @returns le nombre de secondes avant expiration du code (pour l'UI).
   */
  async requestOtp(phoneNumber: string): Promise<{ expiresInSeconds: number }> {
    await this.enforceRateLimits(phoneNumber);

    const code = this.generateCode();
    const hash = this.hashCode(phoneNumber, code);

    // Un seul code actif à la fois : on écrase le précédent et on remet le
    // compteur de tentatives à zéro.
    await this.redis
      .multi()
      .set(this.codeKey(phoneNumber), hash, 'EX', this.ttlSeconds)
      .del(this.attemptsKey(phoneNumber))
      .set(this.cooldownKey(phoneNumber), '1', 'EX', this.resendCooldownSeconds)
      .exec();

    await this.smsService.sendOtp(phoneNumber, code);

    return { expiresInSeconds: this.ttlSeconds };
  }

  /**
   * Vérifie le code fourni. En cas de succès, le code est consommé (supprimé).
   * @throws UnauthorizedException si le code est absent, expiré ou incorrect.
   * @throws TooManyRequestsException si le nombre de tentatives est dépassé.
   */
  async verifyOtp(phoneNumber: string, code: string): Promise<void> {
    // Contournement de développement : accepte un code fixe pour tout numéro.
    if (this.devBypassCode && code === this.devBypassCode) {
      await this.invalidate(phoneNumber);
      return;
    }

    const storedHash = await this.redis.get(this.codeKey(phoneNumber));
    if (!storedHash) {
      throw new UnauthorizedException(
        'Code expiré ou inexistant. Demandez un nouveau code.',
      );
    }

    // Comptabiliser la tentative AVANT la comparaison, avec la même durée de vie
    // que le code, pour que le plafond ne puisse pas être contourné.
    const attempts = await this.redis.incr(this.attemptsKey(phoneNumber));
    if (attempts === 1) {
      await this.redis.expire(this.attemptsKey(phoneNumber), this.ttlSeconds);
    }
    if (attempts > this.maxAttempts) {
      await this.invalidate(phoneNumber);
      throw new HttpException(
        'Trop de tentatives. Demandez un nouveau code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const candidateHash = this.hashCode(phoneNumber, code);
    if (!this.hashesEqual(candidateHash, storedHash)) {
      throw new UnauthorizedException('Code incorrect.');
    }

    // Succès : le code est à usage unique, on le consomme.
    await this.invalidate(phoneNumber);
  }

  private async enforceRateLimits(phoneNumber: string): Promise<void> {
    const cooldown = await this.redis.ttl(this.cooldownKey(phoneNumber));
    if (cooldown > 0) {
      throw new HttpException(
        `Veuillez patienter ${cooldown} seconde(s) avant de redemander un code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const sends = await this.redis.incr(this.sendsKey(phoneNumber));
    if (sends === 1) {
      await this.redis.expire(this.sendsKey(phoneNumber), 3600);
    }
    if (sends > this.maxSendsPerHour) {
      throw new HttpException(
        'Trop de demandes de code pour ce numéro. Réessayez plus tard.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async invalidate(phoneNumber: string): Promise<void> {
    await this.redis.del(this.codeKey(phoneNumber), this.attemptsKey(phoneNumber));
  }

  private generateCode(): string {
    // randomInt est cryptographiquement sûr. On génère un entier dans
    // [0, 10^length) puis on complète avec des zéros à gauche.
    const max = 10 ** this.length;
    const value = randomInt(0, max);
    return value.toString().padStart(this.length, '0');
  }

  private hashCode(phoneNumber: string, code: string): string {
    return createHmac('sha256', this.pepper)
      .update(`${phoneNumber}:${code}`)
      .digest('hex');
  }

  private hashesEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }

  private codeKey(phone: string): string {
    return `otp:code:${phone}`;
  }

  private attemptsKey(phone: string): string {
    return `otp:attempts:${phone}`;
  }

  private cooldownKey(phone: string): string {
    return `otp:cooldown:${phone}`;
  }

  private sendsKey(phone: string): string {
    return `otp:sends:${phone}`;
  }
}
