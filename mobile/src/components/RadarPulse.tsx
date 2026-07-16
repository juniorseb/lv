import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

// Cercle progressif animé (Design System §9) : évoque « le système cherche des
// livreurs autour de vous ». Deux anneaux orange qui s'étendent et s'estompent
// en boucle, autour d'un point central. Aucune dépendance (Animated natif).
export default function RadarPulse({ size = 96 }: { size?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const la = loop(a, 0);
    const lb = loop(b, 900);
    la.start();
    lb.start();
    return () => {
      la.stop();
      lb.stop();
    };
  }, [a, b]);

  const ring = (val: Animated.Value) => ({
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [
      { scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
    ],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, ring(a)]}
      />
      <Animated.View
        style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, ring(b)]}
      />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.orange,
    backgroundColor: 'rgba(249,115,22,0.06)',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.orange,
  },
});
