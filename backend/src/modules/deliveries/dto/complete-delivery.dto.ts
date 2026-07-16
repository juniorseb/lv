import { IsString, Matches } from 'class-validator';

// Validation « Livré » : le livreur saisit le code à 4 chiffres que le client
// lui communique à la remise du colis (preuve de livraison, dossier §6).
export class CompleteDeliveryDto {
  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'Code de livraison invalide (4 chiffres).' })
  code: string;
}
