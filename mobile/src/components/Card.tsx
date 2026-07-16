import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { radius, shadow, space } from '../theme/tokens';

// Carte = composant central de l'UI (Design System §6). Fond blanc, coins
// arrondis, ombre légère (pas de bordure lourde, §7), beaucoup d'espace.
// Pressable si onPress est fourni (carte → détail).
type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

export default function Card({ children, onPress, style }: Props) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow.card,
  },
  pressed: { opacity: 0.96, transform: [{ scale: 0.995 }] },
});
