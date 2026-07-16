import { StyleSheet, Text, TextStyle } from 'react-native';

// Applique la police de marque Manrope à TOUT le texte (Design System §4) sans
// avoir à toucher chaque écran : on intercepte le rendu de <Text> et on choisit
// la variante Manrope correspondant au fontWeight demandé (une famille par
// poids avec @expo-google-fonts). Un fontFamily explicite est toujours respecté.
function familyForWeight(weight?: TextStyle['fontWeight']): string {
  switch (String(weight)) {
    case '900':
    case '800':
      return 'Manrope_800ExtraBold';
    case '700':
    case 'bold':
      return 'Manrope_700Bold';
    case '600':
      return 'Manrope_600SemiBold';
    case '500':
      return 'Manrope_500Medium';
    default:
      return 'Manrope_400Regular';
  }
}

export function applyManropeGlobally(): void {
  const AnyText = Text as unknown as {
    render?: (...args: unknown[]) => unknown;
    __manropePatched?: boolean;
  };
  if (AnyText.__manropePatched || typeof AnyText.render !== 'function') {
    return;
  }
  const original = AnyText.render;
  AnyText.render = function patched(...args: unknown[]) {
    const props = args[0] as { style?: unknown } | undefined;
    const flat = (StyleSheet.flatten(props?.style) || {}) as TextStyle;
    const fontFamily = flat.fontFamily || familyForWeight(flat.fontWeight);
    const nextProps = { ...(props ?? {}), style: [props?.style, { fontFamily }] };
    return original.call(this, nextProps, ...args.slice(1));
  };
  AnyText.__manropePatched = true;
}
