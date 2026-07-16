import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deliveriesApi } from '../../api/deliveries';
import { colors } from '../../theme/colors';

// « Mon solde » — tableau de bord des gains (spec-app-navigation-roles §4).
// PAS un portefeuille : le client paie le livreur en direct, Livrechap
// n'encaisse rien. C'est un suivi d'activité/revenu, sans retrait.
export default function SoldeScreen() {
  const query = useQuery({
    queryKey: ['driver-earnings'],
    queryFn: () => deliveriesApi.driverEarnings(),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }

  const e = query.data;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Revenu total encaissé</Text>
          <Text style={styles.heroValue}>
            {(e?.totalRevenueFcfa ?? 0).toLocaleString('fr-FR')} FCFA
          </Text>
          <Text style={styles.heroSub}>
            {e?.totalDeliveries ?? 0} livraison
            {(e?.totalDeliveries ?? 0) > 1 ? 's' : ''} effectuée
            {(e?.totalDeliveries ?? 0) > 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            Le client vous paie directement (espèces ou mobile money) à chaque
            course. Ce montant est un suivi de votre activité — il n'y a rien à
            retirer ici.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  centered: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 24 },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  heroLabel: { color: colors.white, opacity: 0.8, fontSize: 14 },
  heroValue: {
    color: colors.white,
    fontSize: 34,
    fontWeight: '800',
    marginVertical: 6,
  },
  heroSub: { color: colors.white, opacity: 0.9, fontSize: 15 },
  note: {
    marginTop: 20,
    backgroundColor: colors.grayLight,
    borderRadius: 14,
    padding: 16,
  },
  noteText: { color: colors.gray, fontSize: 14, lineHeight: 20 },
});
