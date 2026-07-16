import { IsString, MinLength } from 'class-validator';

// Rafraîchissement de session : échange d'un refresh token valide contre
// une nouvelle paire de jetons.
export class RefreshTokenDto {
  @IsString()
  @MinLength(20)
  refreshToken: string;
}
