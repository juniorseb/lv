import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { radius, shadow } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
};

// Bouton large, coins arrondis (Design System §5). Un bouton primaire par écran
// (orange, ombre douce). Secondaire = contour bleu nuit. Danger = rouge (annuler).
export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: Props) {
  const isDisabled = disabled || loading;

  const container =
    variant === 'secondary'
      ? styles.secondary
      : variant === 'danger'
        ? styles.danger
        : styles.primary;
  const textStyle =
    variant === 'secondary' ? styles.secondaryText : styles.solidText;
  const spinnerColor = variant === 'secondary' ? colors.navy : colors.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && shadow.card,
        container,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.orange },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  solidText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  secondaryText: { color: colors.navy, fontSize: 18, fontWeight: '700' },
});
