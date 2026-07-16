import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SmsService } from './sms.service';
import { JwtStrategy } from './strategies/jwt.strategy';

// Authentification par téléphone (OTP), sessions, tokens.
// Le client Redis (stockage des OTP) est fourni par le RedisModule global.
// Les secrets/expirations JWT sont passés par appel au moment de la signature
// (deux secrets distincts access/refresh), d'où un JwtModule sans config globale.

@Module({
  imports: [UsersModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, OtpService, SmsService, JwtStrategy],
  exports: [AuthService, SmsService],
})
export class AuthModule {}
