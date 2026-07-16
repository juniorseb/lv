import React, { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';

// Bouton SOS (Livrechap Protect) : déclenchement par APPUI LONG 3 s (l'appui long
// est la confirmation — évite les déclenchements accidentels). Une barre se
// remplit pendant l'appui ; relâcher avant 3 s annule.
const HOLD_MS = 3000;

export default function SosButton({
  onTrigger,
  loading,
}: {
  onTrigger: () => void;
  loading?: boolean;
}) {
  const fill = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  const start = () => {
    setHolding(true);
    Animated.timing(fill, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    timer.current = setTimeout(() => {
      reset();
      onTrigger();
    }, HOLD_MS);
  };

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    reset();
  };

  const reset = () => {
    setHolding(false);
    Animated.timing(fill, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Pressable
      onPressIn={start}
      onPressOut={cancel}
      disabled={loading}
      style={styles.button}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            width: fill.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
      <View style={styles.content}>
        <Text style={styles.label}>
          {loading
            ? 'Envoi…'
            : holding
              ? 'Maintenez…'
              : '🆘 SOS — maintenir 3 s'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    right: undefined,
  },
  content: { alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
