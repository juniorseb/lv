import { BadRequestException } from '@nestjs/common';

import { normalizeIvorianPhone, tryNormalizeIvorianPhone } from './phone.util';

// La normalisation est un point de passage critique : elle décide si deux
// saisies désignent le MÊME compte. Une régression ici et un utilisateur se
// retrouve avec deux comptes, ou le destinataire n'est plus reconnu et perd
// l'accès à sa course.
describe('normalizeIvorianPhone', () => {
  it('accepte le format national et produit de l’E.164', () => {
    expect(normalizeIvorianPhone('0700000000')).toBe('+2250700000000');
  });

  it('rend identiques toutes les écritures d’un même numéro', () => {
    const attendu = '+2250700000000';
    for (const saisie of [
      '0700000000',
      '+2250700000000',
      '2250700000000',
      '002250700000000',
      '07 00 00 00 00',
      '07-00-00-00-00',
      '  0700000000  ',
    ]) {
      expect(normalizeIvorianPhone(saisie)).toBe(attendu);
    }
  });

  it('couvre les préfixes opérateurs ivoiriens', () => {
    // 01 Moov, 05 MTN, 07 Orange.
    expect(normalizeIvorianPhone('0100000000')).toBe('+2250100000000');
    expect(normalizeIvorianPhone('0500000000')).toBe('+2250500000000');
    expect(normalizeIvorianPhone('0700000000')).toBe('+2250700000000');
  });

  it('rejette ce qui n’est pas un numéro ivoirien à 10 chiffres', () => {
    for (const invalide of [
      '',
      '070000000', // 9 chiffres
      '07000000000', // 11 chiffres
      '1700000000', // ne commence pas par 0
      'abcdefghij',
      '+33612345678', // numéro français
    ]) {
      expect(() => normalizeIvorianPhone(invalide)).toThrow(BadRequestException);
    }
  });
});

describe('tryNormalizeIvorianPhone', () => {
  it('normalise comme la version stricte quand le numéro est valide', () => {
    expect(tryNormalizeIvorianPhone('07 00 00 00 00')).toBe('+2250700000000');
  });

  it('renvoie null au lieu de lever — les numéros saisis par un tiers ne sont pas validés', () => {
    for (const invalide of ['', 'pas un numero', '+33612345678', '123']) {
      expect(tryNormalizeIvorianPhone(invalide)).toBeNull();
    }
  });

  it('renvoie null sur null (destinataire non renseigné)', () => {
    expect(tryNormalizeIvorianPhone(null)).toBeNull();
  });

  it('permet de comparer une saisie locale à un compte E.164', () => {
    // Le cas réel : Awa saisie « 0700000002 », son compte est « +2250700000002 ».
    expect(tryNormalizeIvorianPhone('0700000002')).toBe(
      tryNormalizeIvorianPhone('+2250700000002'),
    );
  });

  it('ne fait JAMAIS correspondre deux numéros invalides entre eux', () => {
    // Deux null ne doivent pas ouvrir l'accès à une course : c'est pour cela que
    // l'appelant doit tester la nullité AVANT de comparer.
    const a = tryNormalizeIvorianPhone('inconnu');
    const b = tryNormalizeIvorianPhone('autre-inconnu');
    expect(a).toBeNull();
    expect(b).toBeNull();
  });
});
