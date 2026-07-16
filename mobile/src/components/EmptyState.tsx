import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import PrimaryButton from './PrimaryButton';
import { colors } from '../theme/colors';

// États obligatoires d'un écran (Product Psychology §17) : chargement (informer),
// vide (guider), erreur/hors-ligne (rassurer + proposer une solution). Un seul
// composant pour rester cohérent partout, jamais un « Recherche… » brut.
type Props = {
  emoji?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({
  emoji = '📭',
  title,
  subtitle,
  actionLabel,
  onAction,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <PrimaryButton
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

// Chargement — « informer » (§17).
export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.orange} size="large" />
      {label ? <Text style={styles.subtitle}>{label}</Text> : null}
    </View>
  );
}

// Succès — « récompenser » (§17 / §14 Satisfaction). Moment positif après une
// livraison réussie.
export function SuccessState({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  // Petit rebond du check à l'apparition — « Satisfaction » (§9).
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [pop]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.successBadge,
          {
            opacity: pop,
            transform: [
              {
                scale: pop.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.successCheck}>✓</Text>
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <PrimaryButton
          label={actionLabel}
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

// Erreur / hors-ligne — « rassurer + proposer une solution » (§17).
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      emoji="📡"
      title="Connexion perdue"
      subtitle="Vérifiez votre connexion. Vos données sont en sécurité, rien n'est perdu."
      actionLabel={onRetry ? 'Réessayer' : undefined}
      onAction={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: { fontSize: 44, marginBottom: 12 },
  successBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successCheck: { fontSize: 40, color: colors.success, fontWeight: '900' },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 300,
  },
  action: { marginTop: 20, alignSelf: 'stretch' },
});
