import React, { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deliveriesApi } from '../../api/deliveries';
import { driversApi } from '../../api/drivers';
import { getRoute } from '../../api/mapbox';
import { DeliveryStatus, LatLng } from '../../api/types';
import EmptyState, { SuccessState } from '../../components/EmptyState';
import MissionComms from '../../components/MissionComms';
import ProtectControl from '../../components/ProtectControl';
import PrimaryButton from '../../components/PrimaryButton';
import StatusTimeline from '../../components/StatusTimeline';
import TrackingView from '../../components/TrackingView';
import { distanceMeters, getCurrentCoords } from '../../utils/location';
import { colors } from '../../theme/colors';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ActiveDelivery'>;

const ACTIVE: DeliveryStatus[] = ['livreur_trouve', 'colis_recupere'];

// Derniers mètres du trajet : la précision du client devient l'information la
// plus utile de l'écran (ticket-precision-livreur : « visible dès que le livreur
// arrive à proximité du point, en complément du pin GPS »).
const APPROACH_METERS = 300;

// Gestion d'une course acceptée côté livreur : récupérer le colis puis valider
// la livraison avec le code communiqué par le client (le livreur ne voit jamais
// le code, il le saisit — preuve de livraison, dossier §6).
export default function ActiveDeliveryScreen({ route, navigation }: Props) {
  const { deliveryId } = route.params;
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');

  const deliveryQuery = useQuery({
    queryKey: ['delivery', deliveryId],
    queryFn: () => deliveriesApi.get(deliveryId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE.includes(status) ? 8000 : false;
    },
  });

  const pickupMutation = useMutation({
    mutationFn: () => deliveriesApi.pickup(deliveryId),
    onSuccess: (updated) =>
      queryClient.setQueryData(['delivery', deliveryId], updated),
    onError: (e: unknown) =>
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Réessayez.'),
  });

  const completeMutation = useMutation({
    mutationFn: () => deliveriesApi.complete(deliveryId, code.trim()),
    onSuccess: (updated) => {
      queryClient.setQueryData(['delivery', deliveryId], updated);
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: unknown) =>
      Alert.alert(
        'Code incorrect',
        e instanceof Error ? e.message : 'Vérifiez le code.',
      ),
  });

  const delivery = deliveryQuery.data;
  const status = delivery?.status;
  const isTracking = status === 'livreur_trouve' || status === 'colis_recupere';

  // Position du livreur : mise à jour régulière et envoyée au serveur pour que
  // le client suive le trajet en direct (dossier §4).
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  useEffect(() => {
    if (!isTracking) return;
    let active = true;
    const tick = async () => {
      const coords = await getCurrentCoords();
      if (coords && active) {
        setMyPos(coords);
        driversApi.updateLocation(coords).catch(() => {});
      }
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isTracking]);

  const destination: LatLng | null = delivery
    ? status === 'livreur_trouve'
      ? { latitude: delivery.pickup.latitude, longitude: delivery.pickup.longitude }
      : { latitude: delivery.dropoff.latitude, longitude: delivery.dropoff.longitude }
    : null;

  const routeQuery = useQuery({
    queryKey: ['drv-route', deliveryId, status, myPos?.latitude, myPos?.longitude],
    queryFn: () => getRoute(myPos!, destination!),
    enabled: !!(isTracking && myPos && destination),
  });

  // Distance restante : celle de l'itinéraire si on l'a, sinon à vol d'oiseau
  // (l'itinéraire peut être en cours de recalcul entre deux positions GPS).
  const remainingMeters =
    isTracking && myPos && destination
      ? (routeQuery.data?.distanceMeters ?? distanceMeters(myPos, destination))
      : null;
  const isApproaching =
    remainingMeters !== null && remainingMeters <= APPROACH_METERS;

  // Le repère affiché est celui du point vers lequel le livreur roule :
  // récupération d'abord, destinataire ensuite.
  const activeNote =
    status === 'livreur_trouve'
      ? (delivery?.pickupNote ?? null)
      : (delivery?.dropoffNote ?? null);

  if (deliveryQuery.isLoading || !delivery) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <StatusTimeline status={delivery.status} />

        {/* Communication avec le client pendant la mission (spec-communication). */}
        {(delivery.status === 'livreur_trouve' ||
          delivery.status === 'colis_recupere') && (
          <>
            <MissionComms deliveryId={delivery.id} status={delivery.status} />
            <ProtectControl role="livreur" deliveryId={delivery.id} />
          </>
        )}

        {/* Approche du point : la précision du client passe en tête d'écran et
            en version renforcée — c'est le moment où elle sert. */}
        {isApproaching && activeNote ? (
          <View style={styles.approachCard}>
            <Text style={styles.approachTitle}>
              {status === 'livreur_trouve'
                ? `Vous arrivez au point de récupération · ${formatMeters(remainingMeters)}`
                : `Vous arrivez chez le destinataire · ${formatMeters(remainingMeters)}`}
            </Text>
            <Text style={styles.approachNote}>📌 {activeNote}</Text>
            {/* Le contact de la phase courante : celui qui remet le colis en
                approche du retrait, le destinataire en approche de la livraison. */}
            {status === 'livreur_trouve' && delivery.pickupContactPhone ? (
              <Text style={styles.approachSub}>
                📞{' '}
                {delivery.pickupContactName
                  ? `${delivery.pickupContactName} · `
                  : ''}
                {delivery.pickupContactPhone}
              </Text>
            ) : null}
            {delivery.recipientPhone && status === 'colis_recupere' ? (
              <Text style={styles.approachSub}>
                📞 {delivery.recipientName ? `${delivery.recipientName} · ` : ''}
                {delivery.recipientPhone}
              </Text>
            ) : null}
          </View>
        ) : null}

        {isTracking && (
          <TrackingView
            title={
              status === 'livreur_trouve'
                ? 'Vers la récupération 📍'
                : 'Vers le destinataire 🎯'
            }
            driver={myPos}
            destination={destination}
            route={routeQuery.data ?? null}
          />
        )}

        {/* Hors approche, la précision reste visible mais discrète (elle est
            déjà affichée en grand ci-dessus dans les derniers 300 m). */}
        {activeNote && !isApproaching ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteLabel}>
              {status === 'livreur_trouve'
                ? '📌 Repère — point de récupération'
                : '📌 Repère — chez le destinataire'}
            </Text>
            <Text style={styles.noteText}>{activeNote}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          {delivery.urgency !== 'normal' ? (
            <Text style={styles.urgencyBadge}>
              {delivery.urgency === 'express' ? '🚀 Express' : '⚡ Urgent'}
            </Text>
          ) : null}
          <Text style={styles.price}>{delivery.priceFcfa} FCFA</Text>
          <Text style={styles.paymentHint}>
            Frais de livraison, à encaisser directement auprès du client.
          </Text>
          {delivery.isCod ? (
            <View style={styles.codBanner}>
              <Text style={styles.codBannerTitle}>💵 Paiement à la réception</Text>
              <Text style={styles.codBannerText}>
                Collectez aussi{' '}
                {(delivery.codArticleAmountFcfa ?? 0).toLocaleString('fr-FR')} FCFA
                (prix de l'article) à reverser au vendeur.
              </Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <Row label="📍 Récupération" value={delivery.pickup.address} />
          {delivery.pickupContactPhone ? (
            <Row
              label="📞 Sur place"
              value={`${delivery.pickupContactName ? delivery.pickupContactName + ' · ' : ''}${delivery.pickupContactPhone}`}
            />
          ) : null}
          <Row label="🎯 Destination" value={delivery.dropoff.address} />
          {delivery.recipientPhone ? (
            <Row
              label="📞 Destinataire"
              value={`${delivery.recipientName ? delivery.recipientName + ' · ' : ''}${delivery.recipientPhone}`}
            />
          ) : null}
          {delivery.description ? (
            <Row label="📝 Description" value={delivery.description} />
          ) : null}
        </View>

        {delivery.status === 'livreur_trouve' && (
          <PrimaryButton
            label="J'ai récupéré le colis"
            onPress={() => pickupMutation.mutate()}
            loading={pickupMutation.isPending}
            style={styles.action}
          />
        )}

        {delivery.status === 'colis_recupere' && (
          <View style={styles.action}>
            <Text style={styles.label}>Code de livraison du client</Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              placeholder="––––"
              placeholderTextColor={colors.grayLight}
              keyboardType="number-pad"
              maxLength={4}
              textAlign="center"
            />
            <PrimaryButton
              label="Valider la livraison"
              onPress={() => completeMutation.mutate()}
              loading={completeMutation.isPending}
              disabled={code.length < 4}
              style={styles.validate}
            />
          </View>
        )}

        {delivery.status === 'terminee' && (
          <SuccessState
            title="Livraison réussie 🎉"
            subtitle="Bravo ! La course est terminée et comptée dans vos gains."
            actionLabel="Retour aux missions"
            onAction={() => navigation.navigate('Livreur')}
          />
        )}

        {delivery.status === 'annulee' && (
          <EmptyState
            emoji="🚫"
            title="Course annulée par le client"
            subtitle="Pas de souci, d'autres missions vous attendent."
            actionLabel="Retour aux missions"
            onAction={() => navigation.navigate('Livreur')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// « 180 m » sous le kilomètre, « 1,2 km » au-dessus.
function formatMeters(meters: number | null): string {
  if (meters === null) return '';
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  centered: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { padding: 24 },
  approachCard: {
    backgroundColor: colors.orange,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: colors.orange,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  approachTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  approachNote: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 27,
  },
  approachSub: {
    fontSize: 14,
    color: colors.white,
    marginTop: 10,
    fontWeight: '600',
  },
  noteCard: {
    backgroundColor: '#FFF6EF',
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.orange,
    marginBottom: 4,
  },
  noteText: { fontSize: 16, color: colors.navy, fontWeight: '600' },
  card: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  price: { fontSize: 28, fontWeight: '800', color: colors.orange },
  paymentHint: { fontSize: 13, color: colors.gray, marginTop: 2 },
  urgencyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDECEA',
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  codBanner: {
    backgroundColor: '#FFF6EF',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  codBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.navy },
  codBannerText: {
    fontSize: 13,
    color: colors.navy,
    marginTop: 4,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.grayLight,
    marginVertical: 14,
  },
  row: { marginBottom: 12 },
  rowLabel: { fontSize: 13, color: colors.gray, marginBottom: 2 },
  rowValue: { fontSize: 15, color: colors.navy },
  action: { marginTop: 8 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: 8,
  },
  codeInput: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    paddingVertical: 16,
    fontSize: 32,
    letterSpacing: 12,
    color: colors.navy,
  },
  validate: { marginTop: 16 },
  doneBox: { alignItems: 'center', marginTop: 8 },
  doneText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: 16,
  },
});
