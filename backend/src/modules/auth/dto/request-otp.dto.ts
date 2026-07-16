import { IsString, MaxLength, MinLength } from 'class-validator';

// Étape 1 du parcours : la personne saisit son numéro pour recevoir un code.
export class RequestOtpDto {
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phoneNumber: string;
}
