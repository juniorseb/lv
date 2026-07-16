import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DeliveryStatus } from '../api/types';
import { colors } from '../theme/colors';

const STATUS_STEPS: { key: DeliveryStatus; label: string; emoji: string }[] = [
  { key: 'recherche', label: 'Recherche', emoji: '🟡' },
  { key: 'livreur_trouve', label: 'Livreur trouvé', emoji: '🏍️' },
  { key: 'colis_recupere', label: 'Colis récupéré', emoji: '📦' },
  { key: 'terminee', label: 'Terminée', emoji: '✅' },
];

// Frise du parcours de suivi (dossier §4). Partagée entre l'expéditeur et le
// livreur pour un langage visuel cohérent.
export default function StatusTimeline({ status }: { status: DeliveryStatus }) {
  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === status);
  return (
    <View style={styles.timeline}>
      {STATUS_STEPS.map((step, index) => {
        const done = currentIndex >= index && status !== 'annulee';
        return (
          <View key={step.key} style={styles.step}>
            <Text style={[styles.emoji, !done && styles.dim]}>{step.emoji}</Text>
            <Text style={[styles.label, done && styles.active]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  step: { alignItems: 'center', flex: 1 },
  emoji: { fontSize: 22 },
  dim: { opacity: 0.3 },
  label: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 4,
    textAlign: 'center',
  },
  active: { color: colors.navy, fontWeight: '600' },
});
