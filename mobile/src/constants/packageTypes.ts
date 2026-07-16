import { PackageType } from '../api/types';

// Types de colis autorisés (dossier §4). Les objets interdits sont exclus par
// les CGU (dossier §6).
export const PACKAGE_TYPES: { value: PackageType; label: string }[] = [
  { value: 'documents', label: 'Documents' },
  { value: 'vetements', label: 'Vêtements' },
  { value: 'alimentation', label: 'Alimentation' },
  { value: 'petit_colis', label: 'Petit colis' },
  { value: 'autre', label: 'Autre' },
];

// Emoji par type de véhicule (dossier §4).
export const VEHICLE_EMOJI: Record<string, string> = {
  moto: '🏍️',
  voiture: '🚗',
  velo: '🚲',
  a_pied: '🚶',
};
