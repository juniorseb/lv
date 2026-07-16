import { TextStyle, ViewStyle } from 'react-native';

// Design system Livrechap (Spec — Design System & Direction Artistique v1.0).
// Tokens partagés : rayons, espacements, ombres douces, échelle typographique.
// La couche couleur reste dans theme/colors.ts.

// Rayons — coins arrondis généreux (§6 cartes, §5 boutons).
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

// Espacements — grille de 4, pour laisser l'écran respirer (§2.1).
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Ombres légères — profondeur naturelle, jamais lourdes ni 3D (§7). Teintées
// bleu nuit pour paraître « choisies » plutôt qu'un gris par défaut.
export const shadow: Record<'card' | 'raised', ViewStyle> = {
  card: {
    shadowColor: '#14213D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  raised: {
    shadowColor: '#14213D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
};

// Familles de police de marque Manrope (§4), chargées dans App.tsx via
// @expo-google-fonts/manrope. `medium` pour le corps, `semibold` pour les
// libellés, `bold`/`extrabold` pour titres et informations principales.
export const fonts = {
  extrabold: 'Manrope_800ExtraBold',
  bold: 'Manrope_700Bold',
  semibold: 'Manrope_600SemiBold',
  medium: 'Manrope_500Medium',
  regular: 'Manrope_400Regular',
};

// Échelle typographique — lecture instantanée, la hiérarchie guide l'œil (§4).
// Le poids est porté par la FAMILLE Manrope (pas de fontWeight, qui entrerait
// en conflit avec une famille déjà pondérée sur Android).
export const type: Record<
  'title' | 'heading' | 'price' | 'subtitle' | 'body' | 'label' | 'caption',
  TextStyle
> = {
  // Titres : grande taille, poids élevé, peu de mots (« Votre colis arrive »).
  title: { fontSize: 26, fontFamily: fonts.extrabold },
  heading: { fontSize: 20, fontFamily: fonts.extrabold },
  // Information principale immédiatement visible (1 500 FCFA, 8 min, 10 colis).
  price: { fontSize: 22, fontFamily: fonts.extrabold },
  subtitle: { fontSize: 16, fontFamily: fonts.bold },
  body: { fontSize: 15, fontFamily: fonts.medium },
  label: { fontSize: 14, fontFamily: fonts.semibold },
  // Information secondaire, plus discrète (Cocody → Marcory, Aujourd'hui 14h).
  caption: { fontSize: 13, fontFamily: fonts.regular },
};
