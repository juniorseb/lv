import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { walletApi } from '../../api/wallet';
import { WalletTransaction } from '../../api/types';
import PrimaryButton from '../../components/PrimaryButton';
import { colors } from '../../theme/colors';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Caution'>;

const TX_LABEL: Record<string, string> = {
  recharge: 'Recharge',
  commission: 'Commission livraison',
  bonus: 'Bonus',
  ajustement: 'Ajustement',
};

// « Ma caution » (spec-app-navigation-roles §5) : la caution EST le mécanisme
// de collecte de la commission 10 %. Chaque livraison terminée la débite ; sous
// le seuil, le livreur ne reçoit plus de courses jusqu'à recharge.
export default function CautionScreen({ navigation }: Props) {
  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getMyWallet(),
  });
  const txQuery = useQuery({
    queryKey: ['wallet-tx'],
    queryFn: () => walletApi.getMyTransactions(),
  });

  if (walletQuery.isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }

  const wallet = walletQuery.data;
  const low = wallet?.lowBalance ?? false;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Solde de la caution</Text>
          <Text style={styles.heroValue}>
            {(wallet?.balanceFcfa ?? 0).toLocaleString('fr-FR')} FCFA
          </Text>
        </View>

        {low && (
          <View style={styles.alert}>
            <Text style={styles.alertText}>
              ⚠️ Caution basse. Rechargez pour continuer à recevoir des courses.
            </Text>
          </View>
        )}

        <Text style={styles.explain}>
          La commission de 10 % de chaque livraison est débitée de votre caution.
          Le solde restant vous est remboursé si vous quittez la plateforme sans
          litige en cours.
        </Text>

        <PrimaryButton
          label="Recharger ma caution"
          onPress={() => navigation.navigate('Recharge')}
          style={styles.recharge}
        />

        <Text style={styles.historyTitle}>Mouvements</Text>
        {(txQuery.data ?? []).length === 0 ? (
          <Text style={styles.empty}>Aucun mouvement pour le moment.</Text>
        ) : (
          (txQuery.data ?? []).map((tx: WalletTransaction) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.flex}>
                <Text style={styles.txLabel}>
                  {TX_LABEL[tx.type] ?? tx.type}
                </Text>
                <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  { color: tx.amountFcfa < 0 ? colors.danger : colors.success },
                ]}
              >
                {tx.amountFcfa > 0 ? '+' : ''}
                {tx.amountFcfa.toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  centered: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
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
    marginTop: 6,
  },
  alert: {
    marginTop: 16,
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    padding: 14,
  },
  alertText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  explain: {
    marginTop: 16,
    color: colors.gray,
    fontSize: 14,
    lineHeight: 20,
  },
  recharge: { marginTop: 16 },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
    marginTop: 28,
    marginBottom: 12,
  },
  empty: { color: colors.gray, fontSize: 14 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
    paddingVertical: 12,
  },
  txLabel: { fontSize: 15, color: colors.navy, fontWeight: '500' },
  txDate: { fontSize: 12, color: colors.gray, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700' },
});
