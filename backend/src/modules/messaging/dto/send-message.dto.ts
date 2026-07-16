import { IsString, MaxLength, MinLength } from 'class-validator';

// Envoi d'un message (texte seul, spec-communication §10).
export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body: string;
}
