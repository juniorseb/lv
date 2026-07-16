import { BadRequestException } from '@nestjs/common';

// Indicatif Côte d'Ivoire.
const CI_COUNTRY_CODE = '225';

// Depuis 2021, les numéros mobiles ivoiriens comptent 10 chiffres et commencent
// par 0 (préfixes opérateurs : 01 Moov, 05 MTN, 07 Orange, plus 25/27 fixes).
// On accepte les saisies locales et internationales courantes puis on normalise
// vers l'E.164 : +225XXXXXXXXXX (225 suivi des 10 chiffres nationaux).
const CI_NATIONAL_REGEX = /^0[0-9]{9}$/;

/**
 * Variante tolérante de `normalizeIvorianPhone` : renvoie null au lieu de lever.
 * Pour les numéros SAISIS PAR UN TIERS (destinataire, contact de récupération) :
 * ils ne sont pas validés à la création, on ne veut donc pas qu'une comparaison
 * fasse échouer la requête. Sert à rapprocher un numéro d'un compte existant.
 */
export function tryNormalizeIvorianPhone(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return normalizeIvorianPhone(raw);
  } catch {
    return null;
  }
}

/**
 * Normalise un numéro ivoirien vers le format E.164 (+225XXXXXXXXXX).
 * Accepte : "0700000000", "+2250700000000", "002250700000000",
 * "07 00 00 00 00" et variantes avec espaces/tirets.
 * Lève BadRequestException si le format est invalide.
 */
export function normalizeIvorianPhone(raw: string): string {
  if (!raw) {
    throw new BadRequestException('Numéro de téléphone requis.');
  }

  // Ne conserver que les chiffres, et repérer un éventuel '+' initial.
  const trimmed = raw.trim();
  let digits = trimmed.replace(/[^\d]/g, '');

  // Retirer le préfixe international '00' éventuel (ex: 00225...).
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Retirer l'indicatif pays s'il est présent (ex: 2250700000000).
  if (digits.startsWith(CI_COUNTRY_CODE)) {
    digits = digits.slice(CI_COUNTRY_CODE.length);
  }

  if (!CI_NATIONAL_REGEX.test(digits)) {
    throw new BadRequestException(
      'Numéro de téléphone invalide. Format attendu : un numéro ivoirien à 10 chiffres (ex: 0700000000).',
    );
  }

  return `+${CI_COUNTRY_CODE}${digits}`;
}
