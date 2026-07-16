// Badges de confiance affichés sur le profil public du livreur
// (spec-onboarding-livreur-v2 P2). Dérivés des statistiques et du niveau de
// vérification — aucune donnée sensible.
export interface Badge {
  key: string;
  label: string;
}

export function computeDriverBadges(input: {
  verificationLevel: string;
  ratingAverage: number;
  totalDeliveries: number;
}): Badge[] {
  const badges: Badge[] = [];
  if (input.verificationLevel === 'verifie') {
    badges.push({ key: 'verifie', label: 'Identité vérifiée' });
  }
  if (input.totalDeliveries >= 50) {
    badges.push({ key: 'experimente', label: 'Expérimenté' });
  }
  if (input.ratingAverage >= 4.8 && input.totalDeliveries >= 10) {
    badges.push({ key: 'top_note', label: 'Très bien noté' });
  }
  if (input.totalDeliveries < 5) {
    badges.push({ key: 'nouveau', label: 'Nouveau' });
  }
  return badges;
}
