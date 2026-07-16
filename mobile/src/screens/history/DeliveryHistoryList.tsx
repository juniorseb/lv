import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState, { ErrorState, LoadingState } from '../../components/EmptyState';
import { Delivery, DeliveryStatus } from '../../api/types';
import { colors } from '../../theme/colors';
import { radius, shadow, space } from '../../theme/tokens';

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  recherche: 'Recherche',
  livreur_trouve: 'Livreur trouvé',
  colis_recupere: 'En cours',
  terminee: 'Livrée',
  annulee: 'Annulée',
  // Personne n'a annulé : aucun livreur ne s'est libéré à temps.
  expiree: 'Sans réponse',
};

function statusColor(status: DeliveryStatus): string {
  if (status === 'terminee') return colors.success;
  if (status === 'annulee') return colors.danger;
  // Expirée = neutre, pas un échec imputable au client.
  if (status === 'expiree') return colors.gray;
  return colors.orange;
}

// Liste d'historique réutilisée côté client (expéditions) et livreur (courses).
export default function DeliveryHistoryList({
  data,
  loading,
  error,
  onRetry,
  emptyLabel,
  emptySubtitle,
  onPressItem,
}: {
  data: Delivery[] | undefined;
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  emptyLabel: string;
  emptySubtitle?: string;
  onPressItem: (delivery: Delivery) => void;
}) {
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <LoadingState />
      </SafeAreaView>
    );
  }
  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ErrorState onRetry={onRetry} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={data ?? []}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <EmptyState
            emoji="📦"
            title={emptyLabel}
            subtitle={emptySubtitle}
          />
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onPressItem(item)}>
            <View style={styles.flex}>
              <Text style={styles.route} numberOfLines={1}>
                {item.pickup.address} → {item.dropoff.address}
              </Text>
              <Text style={styles.meta}>
                {formatDate(item.createdAt)} · {item.priceFcfa} FCFA
              </Text>
            </View>
            <Text style={[styles.status, { color: statusColor(item.status) }]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: space.lg,
    ...shadow.card,
  },
  route: { fontSize: 15, fontWeight: '600', color: colors.navy },
  meta: { fontSize: 13, color: colors.gray, marginTop: 3 },
  status: { fontSize: 13, fontWeight: '700' },
});
