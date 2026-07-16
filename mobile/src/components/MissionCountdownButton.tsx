import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';

// Bouton « Accepter » avec décompte : le fond se vide comme de l'eau au fil du
// temps restant (façon Yango/inDrive) pour pousser à la décision. Passe à l'orange
// vif puis au rouge à l'approche de la fin, et prévient le parent à l'expiration.
export default function MissionCountdownButton({
  expiresAt,
  windowStartedAt,
  createdAt,
  accepting,
  onAccept,
  onExpire,
}: {
  expiresAt: string | null;
  // Ouverture du palier de ce livreur (cercle progressif). La barre est calibrée
  // sur SA fenêtre, pas sur la fenêtre globale : un livreur du dernier palier
  // voit une barre pleine sur sa minute, et non une barre déjà aux 2/3 vidée.
  windowStartedAt: string | null;
  createdAt: string;
  accepting: boolean;
  onAccept: () => void;
  onExpire: () => void;
}) {
  const endMs = expiresAt ? new Date(expiresAt).getTime() : null;
  const startMs = new Date(windowStartedAt ?? createdAt).getTime();
  const totalMs = endMs ? Math.max(endMs - startMs, 1) : 1;

  const fill = useRef(new Animated.Value(1)).current;
  const [secondsLeft, setSecondsLeft] = useState(() =>
    endMs ? Math.max(Math.ceil((endMs - Date.now()) / 1000), 0) : 0,
  );

  useEffect(() => {
    if (!endMs) return;
    const remaining = endMs - Date.now();
    if (remaining <= 0) {
      onExpire();
      return;
    }

    // La barre reprend là où elle en est (mission déjà entamée à l'affichage).
    fill.setValue(Math.min(remaining / totalMs, 1));
    const anim = Animated.timing(fill, {
      toValue: 0,
      duration: remaining,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) onExpire();
    });

    const tick = setInterval(() => {
      const left = Math.max(Math.ceil((endMs - Date.now()) / 1000), 0);
      setSecondsLeft(left);
      if (left <= 0) clearInterval(tick);
    }, 500);

    return () => {
      anim.stop();
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endMs, totalMs]);

  // Sans expiration configurée : bouton classique.
  if (!endMs) {
    return (
      <Pressable
        style={[styles.button, styles.plain]}
        onPress={onAccept}
        disabled={accepting}
      >
        {accepting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.label}>Accepter</Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.button} onPress={onAccept} disabled={accepting}>
      {/* Réserve qui se vide : largeur ∝ temps restant. */}
      <Animated.View
        style={[
          styles.fill,
          {
            width: fill.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
            backgroundColor: fill.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [colors.danger, colors.danger, colors.orange],
            }),
          },
        ]}
      />
      <View style={styles.content}>
        {accepting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.label}>Accepter · {secondsLeft}s</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: radius.md,
    // Fond « vidé » : le reste du chemin, une fois l'eau écoulée.
    backgroundColor: colors.grayLight,
    overflow: 'hidden',
    justifyContent: 'center',
    marginTop: 12,
  },
  plain: { backgroundColor: colors.orange },
  fill: { ...StyleSheet.absoluteFillObject, right: undefined },
  content: { alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
