import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { DevicePlatform } from '../entities/device-token.entity';

// Enregistrement d'un jeton d'appareil FCM pour recevoir les push.
export class RegisterDeviceDto {
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  token: string;

  @IsOptional()
  @IsIn(['android', 'ios', 'web'])
  platform?: DevicePlatform;
}
