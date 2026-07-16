import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../api/client';
import { toursApi } from '../../api/tours';
import { TourOffer, TourStopClient } from '../../api/types';
import { colors } from '../../theme/colors';
import { radius, shadow } from '../../theme/tokens';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'TourDetail'>;

const STOP_STATUS: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: colors.gray },
  en_route: { label: 'En route', color: colors.warning },
  livre: { label: 'Livré ✓', color: colors.success },
  probleme: { label: 'Problème', color: colors.danger },
  retour: { label: 'Retour', color: colors.danger },
};

export default function TourDetailScreen({ route }: Props) {
  const { requestId } = route.params;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['tour', requestId],
    queryFn: () => toursApi.get(requestId),
    refetchInterval: 15000,
  });
  const offersQuery = useQuery({
    queryKey: ['tour-offers', requestId],
    queryFn: () => toursApi.offers(requestId),
    enabled: query.data ? !query.data.hasDriver : false,
    refetchInterval: 15000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tour', requestId] });
    queryClient.invalidateQueries({ queryKey: ['tour-offers', requestId] });
  };

  const acceptOffer = useMutation({
    mutationFn: (offerId: string) => toursApi.acceptOffer(offerId),
    onSuccess: refresh,
    onError: (e: unknown) =>
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.'),
  });
  const refuseOffer = useMutation({
    mutationFn: (offerId: string) => toursApi.refuseOffer(offerId),
    onSuccess: refresh,
    onError: (e: unknown) =>
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.'),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }
  if (!query.data) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.muted}>Tournée introuvable.</Text>
      </SafeAreaView>
    );
  }

  const t = query.data;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>
            {t.status === 'terminee'
              ? 'Tournée terminée'
              : t.hasDriver
                ? 'Livreur en route'
                : 'En recherche de livreur'}
          </Text>
          <Text style={styles.heroValue}>
            {t.deliveredStops}/{t.totalStops} colis livrés
          </Text>
          <Text style={styles.heroTotal}>
            {t.totalPriceFcfa.toLocaleString('fr-FR')} FCFA · départ{' '}
            {t.departAddress ?? '—'}
          </Text>
        </View>

        {/* Offres de prix reçues (négociation) */}
        {!t.hasDriver && (offersQuery.data ?? []).length > 0 && (
          <View style={styles.offers}>
            <Text style={styles.offersTitle}>
              Offres de livreurs ({(offersQuery.data ?? []).length})
            </Text>
            {(offersQuery.data ?? []).map((offer: TourOffer) => (
              <View key={offer.id} style={styles.offer}>
                <View style={styles.flex}>
                  <Text style={styles.offerPrice}>
                    {offer.prixProposeFcfa.toLocaleString('fr-FR')} FCFA
                  </Text>
                  <Text style={styles.offerDriver}>
                    {offer.driverRating !== null
                      ? `★ ${offer.driverRating.toFixed(1)} · ${offer.driverTotalDeliveries ?? 0} livraisons`
                      : 'Livreur'}
                  </Text>
                </View>
                <Pressable
                  style={styles.offerAccept}
                  onPress={() => acceptOffer.mutate(offer.id)}
                >
                  <Text style={styles.offerAcceptText}>Accepter</Text>
                </Pressable>
                <Pressable
                  onPress={() => refuseOffer.mutate(offer.id)}
                  hitSlop={8}
                >
                  <Text style={styles.offerRefuse}>Refuser</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.hint}>
          Communiquez à chaque destinataire son code — le livreur le demandera
          pour confirmer la livraison.
        </Text>

        {t.stops.map((stop: TourStopClient, i: number) => {
          const st = STOP_STATUS[stop.status] ?? STOP_STATUS.en_attente;
          return (
            <View key={stop.id} style={styles.stop}>
              <View style={styles.stopTop}>
                <Text style={styles.stopIndex}>{i + 1}</Text>
                <View style={styles.flex}>
                  <Text style={styles.stopName}>
                    {stop.recipientName ?? 'Destinataire'}
                    {stop.recipientPhone ? ` · ${stop.recipientPhone}` : ''}
                  </Text>
                  <Text style={styles.stopAddress} numberOfLines={1}>
                    {stop.address}
                  </Text>
                  {stop.items.length > 0 && (
                    <Text style={styles.stopItems} numberOfLines={2}>
                      {stop.items
                        .map((it) => `${it.name} ×${it.quantity}`)
                        .join(', ')}
                    </Text>
                  )}
                </View>
                <Text style={[styles.stopStatus, { color: st.color }]}>
                  {st.label}
                </Text>
              </View>
              <View style={styles.codeRow}>
                <Text style={styles.codeLabel}>Code destinataire</Text>
                <Text style={styles.code}>
                  {stop.status === 'livre' ? '••••' : stop.proofOtp ?? '—'}
                </Text>
                <Text style={styles.stopPrice}>
                  {stop.priceFcfa.toLocaleString('fr-FR')} FCFA
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { color: colors.gray, fontSize: 14 },
  flex: { flex: 1 },
  content: { padding: 24 },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: 20,
    padding: 22,
  },
  heroLabel: { color: colors.white, opacity: 0.8, fontSize: 13 },
  heroValue: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  heroTotal: { color: colors.white, opacity: 0.9, fontSize: 13, marginTop: 6 },
  hint: {
    fontSize: 13,
    color: colors.gray,
    lineHeight: 19,
    marginTop: 16,
    marginBottom: 8,
  },
  offers: { marginTop: 16 },
  offersTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: 10,
  },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  offerPrice: { fontSize: 16, fontWeight: '800', color: colors.navy },
  offerDriver: { fontSize: 12, color: colors.gray, marginTop: 2 },
  offerAccept: {
    backgroundColor: colors.orange,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  offerAcceptText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  offerRefuse: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  stop: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 12,
    ...shadow.card,
  },
  stopTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stopIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.grayLight,
    color: colors.navy,
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 26,
  },
  stopName: { fontSize: 15, fontWeight: '600', color: colors.navy },
  stopAddress: { fontSize: 13, color: colors.gray, marginTop: 2 },
  stopItems: { fontSize: 12, color: colors.navy, marginTop: 3 },
  stopStatus: { fontSize: 13, fontWeight: '700' },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grayLight,
  },
  codeLabel: { fontSize: 13, color: colors.gray },
  code: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.orange,
    letterSpacing: 3,
    flex: 1,
  },
  stopPrice: { fontSize: 14, fontWeight: '700', color: colors.navy },
});
