import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PublicUser } from '../users/user.view';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

// Authentification par téléphone (OTP) — cf. dossier §6 (vérification par palier)
// et §10 (OTP par SMS). Un même numéro = un seul compte, utilisable comme
// expéditeur et comme livreur.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  // Étape 1 : envoi du code OTP.
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  // Étape 2 : vérification du code → connexion ou création de compte + jetons.
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  // Renouvellement de session à partir d'un refresh token.
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // Profil de l'utilisateur connecté (route protégée).
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current: AuthenticatedUser): Promise<PublicUser> {
    const user = await this.usersService.getByIdOrFail(current.id);
    return this.usersService.buildPublicUser(user);
  }
}
