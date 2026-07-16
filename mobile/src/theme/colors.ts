// Identité de marque Livrechap
// Orange = action, rapidité, énergie
// Bleu nuit = confiance, sécurité, sérieux (portefeuille, vérification)
// Blanc = clarté, simplicité (philosophie Wave)

export const colors = {
  orange: '#F97316',
  orangeDark: '#C2570F',
  navy: '#14213D',
  white: '#FFFFFF',
  // Fond d'écran très clair : fait ressortir les cartes blanches + leur ombre
  // (Design System §2.1 « l'écran doit respirer »).
  bg: '#F6F7F9',
  gray: '#5F5E5A',
  grayLight: '#F2F2F2',
  success: '#1D9E75',
  warning: '#EF9F27',
  danger: '#E24B4A',
} as const;

export type ColorKey = keyof typeof colors;
