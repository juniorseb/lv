import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState, { ErrorState, LoadingState } from '../../components/EmptyState';
import { toursApi } from '../../api/tours';
import { colors } from '../../theme/colors';
import { radius, shadow } from '../../theme/tokens';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'TourList'>;

export default function TourListScreen({ navigation }: Props) {
  const query = useQuery({ queryKey: ['tours-mine'], queryFn: () => toursApi.mine() });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState />
      </SafeAreaView>
    );
  }
  if (query.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState onRetry={() => query.refetch()} />
      </SafeAreaView>
    );
  }

  const tours = query.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {tours.length === 0 ? (
          <EmptyState
            emoji="🛵"
            title="Aucune tournée"
            subtitle="Créez une tournée pour distribuer plusieurs colis en une seule fois."
            actionLabel="Distribuer plusieurs colis"
            onAction={() => navigation.navigate('CreateTour')}
          />
        ) : (
          tours.map((t) => (
            <Pressable
              key={t.requestId}
              style={styles.card}
              onPress={() =>
                navigation.navigate('TourDetail', { requestId: t.requestId })
              }
            >
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>
                  {t.totalStops} colis · {t.totalPriceFcfa.toLocaleString('fr-FR')}{' '}
                  FCFA
                </Text>
                <Text style={styles.cardSub}>
                  {t.departAddress ?? 'Tournée'} · {t.deliveredStops}/
                  {t.totalStops} livrés
                </Text>
              </View>
              <Text style={styles.status}>
                {t.status === 'terminee'
                  ? '✅'
                  : t.status === 'annulee'
                    ? '✖'
                    : t.hasDriver
                      ? '🛵'
                      : '🔍'}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: 24, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  cardSub: { fontSize: 13, color: colors.gray, marginTop: 3 },
  status: { fontSize: 22 },
});
