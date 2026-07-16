import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

// Stratégie de validation de l'access token (Authorization: Bearer <token>).
// On recharge l'utilisateur pour garantir qu'il existe toujours et qu'il n'a
// pas été désactivé (users.is_active) depuis l'émission du jeton.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('JWT_ACCESS_SECRET') ?? 'livrechap_dev_access_secret',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Refuser explicitement un refresh token présenté comme jeton d'accès.
    if (payload.type !== 'access') {
      throw new UnauthorizedException("Type de jeton invalide.");
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Compte introuvable ou désactivé.');
    }

    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      accountType: user.accountType,
      isAdmin: user.isAdmin,
    };
  }
}
