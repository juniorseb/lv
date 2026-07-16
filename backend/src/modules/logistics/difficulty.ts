// Score de difficulté d'une mission (spec-delivery-architecture-tournees §2 bis).
// 1 ⭐ (facile) à 5 ⭐ (difficile), dérivé du nombre d'arrêts, de la distance
// totale, de la présence de COD et des zones. Sert à informer le livreur avant
// acceptation et, plus tard, à moduler la rémunération / prioriser l'attribution.
export interface DifficultyInput {
  stopCount: number;
  distanceM?: number | null;
  hasCod?: boolean;
  zoneCount?: number | null;
}

export function computeDifficulty(input: DifficultyInput): number {
  let score = 1;

  // Nombre d'arrêts : principal facteur pour une tournée.
  const stops = Math.max(1, input.stopCount);
  if (stops >= 3) score += 1;
  if (stops >= 6) score += 1;
  if (stops >= 12) score += 1;

  // Distance totale (si connue) : au-delà de 15 km, +1.
  if (input.distanceM && input.distanceM > 15000) {
    score += 1;
  }

  // COD (le livreur détient de l'argent) et multiplicité de zones alourdissent.
  if (input.hasCod) score += 1;
  if (input.zoneCount && input.zoneCount >= 4) score += 1;

  return Math.min(5, score);
}
