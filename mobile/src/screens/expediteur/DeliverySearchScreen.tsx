import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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

import { deliveriesApi } from '../../api/deliveries';
import { matchingApi } from '../../api/matching';
import { getRoute } from '../../api/mapbox';
import { DeliveryStatus, DriverCard } from '../../api/types';
import PrimaryButton from '../../components/PrimaryButton';
import EmptyState, { SuccessState } from '../../components/EmptyState';
import FadeSlideIn from '../../components/FadeSlideIn';
import MissionComms from '../../components/MissionComms';
import ProtectControl from '../../components/ProtectControl';
import { useAuthStore } from '../../store/authStore';
import RadarPulse from '../../components/RadarPulse';
import StatusTimeline from '../../components/StatusTimeline';
import TrackingView from '../../components/TrackingView';
import { radius, shadow } from '../../theme/tokens';
import { VEHICLE_EMOJI } from '../../constants/packageTypes';
import { colors } from '../../theme/colors';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'DeliverySearch'>;

const ACTIVE_STATUSES: DeliveryStatus[] = [
  'recherche',
  'livreur_trouve',
  'colis_recupere',
];

export default function DeliverySearchScreen({ route, navigation }: Props) {
  const { deliveryId } = route.params;
  const queryClient = useQueryClient();
  const myUserId = useAuthStore((s) => s.user?.id);

  const deliveryQuery = useQuery({
    queryKey: ['delivery', deliveryId],
    queryFn: () => deliveriesApi.get(deliveryId),
    // On rafraîchit tant que la livraison est en cours, puis on s'arrête.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE_STATUSES.includes(status) ? 5000 : false;
    },
  });

  const delivery = deliveryQuery.data;
  const isSearching = delivery?.status === 'recherche';

  const driversQuery = useQuery({
    queryKey: ['delivery-drivers', deliveryId],
    queryFn: () => matchingApi.driversForDelivery(deliveryId),
    enabled: isSearching,
    refetchInterval: isSearching ? 4000 : false,
  });

  // Suivi : le livreur va d'abord vers la récupération, puis vers la destination.
  const isTracking =
    delivery?.status === 'livreur_trouve' ||
    delivery?.status === 'colis_recupere';
  const destination = delivery
    ? delivery.status === 'livreur_trouve'
      ? delivery.pickup
      : delivery.dropoff
    : null;

  const driverLocQuery = useQuery({
    queryKey: ['driver-loc', deliveryId],
    queryFn: () => deliveriesApi.driverLocation(deliveryId),
    enabled: !!isTracking,
    refetchInterval: isTracking ? 6000 : false,
  });
  const driverLoc = driverLocQuery.data ?? null;

  const routeQuery = useQuery({
    queryKey: [
      'route',
      deliveryId,
      delivery?.status,
      driverLoc?.latitude,
      driverLoc?.longitude,
    ],
    queryFn: () =>
      getRoute(
        { latitude: driverLoc!.latitude, longitude: driverLoc!.longitude },
        { latitude: destination!.latitude, longitude: destination!.longitude },
      ),
    enabled: !!(isTracking && driverLoc && destination),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => deliveriesApi.cancel(deliveryId, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData(['delivery', deliveryId], updated);
    },
    onError: (e: unknown) => {
      Alert.alert('Annulation impossible', errorMessage(e));
    },
  });

  // L'utilisateur garde le contrôle et explique son choix (Product Psychology
  // §12) : on demande le motif avant d'annuler.
  const confirmCancel = () => {
    Alert.alert('Pourquoi annuler ?', 'Cela nous aide à améliorer le service.', [
      {
        text: "Erreur d'adresse",
        onPress: () => cancelMutation.mutate('erreur_adresse'),
      },
      {
        text: "Je n'ai plus besoin",
        onPress: () => cancelMutation.mutate('plus_besoin'),
      },
      {
        text: "Trop d'attente",
        onPress: () => cancelMutation.mutate('trop_long'),
      },
      {
        text: 'Autre solution trouvée',
        onPress: () => cancelMutation.mutate('autre_solution'),
      },
      { text: 'Autre raison', onPress: () => cancelMutation.mutate('autre') },
      { text: 'Continuer ma livraison', style: 'cancel' },
    ]);
  };

  if (deliveryQuery.isLoading || !delivery) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }

  // Cet écran sert aussi au DESTINATAIRE qui arrive par le lien SMS (« suivez
  // votre colis »). Il ne possède pas la course : annuler ne le concerne pas,
  // et le code, il le DONNE au livreur au lieu de le communiquer.
  const isAuthor = delivery.senderId === myUserId;

  // Parenthèses indispensables : `&&` lie plus fort que `||`, sans elles le
  // statut `livreur_trouve` seul suffirait à autoriser l'annulation.
  const canCancel =
    isAuthor &&
    (delivery.status === 'recherche' || delivery.status === 'livreur_trouve');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <StatusTimeline status={delivery.status} />

        {delivery.status === 'expiree' ? (
          // Formulation honnête : la demande n'a pas « échoué », les livreurs
          // étaient occupés. Et on propose immédiatement la suite.
          <EmptyState
            emoji="🏍️"
            title="Nos livreurs sont tous occupés"
            subtitle={
              isAuthor
                ? "Aucun livreur ne s'est libéré à temps. Republiez votre course — vous pourrez ajuster le prix ou les informations avant."
                : "Aucun livreur ne s'est libéré à temps. La personne qui a commandé la course peut la republier."
            }
            // Republier engage un paiement : réservé à l'expéditeur.
            actionLabel={isAuthor ? 'Republier ma course' : undefined}
            onAction={
              isAuthor
                ? () =>
                    navigation.replace('CreateDelivery', {
                      repostFrom: delivery.id,
                    })
                : undefined
            }
          />
        ) : delivery.status === 'annulee' ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Livraison annulée.</Text>
          </View>
        ) : isSearching ? (
          <SearchPanel
            count={driversQuery.data?.availableCount ?? 0}
            drivers={driversQuery.data?.drivers ?? []}
            message={driversQuery.data?.message ?? null}
            loading={driversQuery.isLoading}
          />
        ) : isTracking ? (
          <>
            <TrackingView
              title={
                delivery.status === 'livreur_trouve'
                  ? 'Votre livreur arrive 🏍️'
                  : 'Votre colis est en route 📦'
              }
              driver={driverLoc}
              destination={destination}
              route={routeQuery.data ?? null}
            />
            <MissionComms deliveryId={delivery.id} status={delivery.status} />
            <ProtectControl role="client" deliveryId={delivery.id} />
          </>
        ) : (
          <SuccessState
            title="Colis livré 🎉"
            subtitle="Votre livraison est arrivée à destination. Merci d'avoir fait confiance à Livrechap."
            actionLabel="Retour à l'accueil"
            onAction={() => navigation.navigate('ClientHome')}
          />
        )}

        {delivery.deliveryCode &&
          delivery.status !== 'annulee' &&
          delivery.status !== 'terminee' && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Code de livraison</Text>
            <Text style={styles.code}>{delivery.deliveryCode}</Text>
            <Text style={styles.codeHint}>
              {isAuthor
                ? 'Communiquez ce code au livreur à la remise du colis.'
                : 'Donnez ce code au livreur quand il vous remet le colis, jamais avant.'}
            </Text>
          </View>
        )}

        <View style={styles.recap}>
          <RecapRow label="Récupération" value={delivery.pickup.address} />
          <RecapRow label="Destination" value={delivery.dropoff.address} />
          <RecapRow label="Prix" value={`${delivery.priceFcfa} FCFA`} />
        </View>

        {/* Annulation possible mais DISCRÈTE : on ne pousse jamais à annuler
            (Product Psychology). Simple lien, pas un bouton rouge proéminent. */}
        {canCancel && (
          <Pressable
            onPress={confirmCancel}
            disabled={cancelMutation.isPending}
            style={styles.cancelLink}
            hitSlop={8}
          >
            <Text style={styles.cancelLinkText}>
              {cancelMutation.isPending ? 'Annulation…' : 'Annuler la livraison'}
            </Text>
          </Pressable>
        )}

        {delivery.status === 'annulee' && (
          <PrimaryButton
            label="Retour à l'accueil"
            onPress={() => navigation.navigate('ClientHome')}
            style={styles.cancel}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SearchPanel({
  count,
  drivers,
  message,
  loading,
}: {
  count: number;
  drivers: DriverCard[];
  message: string | null;
  loading: boolean;
}) {
  const foundNearby = count > 0 || drivers.length > 0;
  return (
    <View style={styles.searchPanel}>
      <RadarPulse />
      <Text style={styles.searchTitle}>Recherche d'un livreur</Text>

      {/* Progression visible plutôt qu'un « Recherche… » brut (§6). */}
      <View style={styles.steps}>
        <StepRow state="done" label="Votre demande est publiée" />
        <StepRow
          state={foundNearby ? 'done' : 'active'}
          label={
            foundNearby
              ? `${count} livreur${count > 1 ? 's' : ''} à proximité contacté${count > 1 ? 's' : ''}`
              : 'Recherche des livreurs proches'
          }
        />
        <StepRow state="pending" label="Un livreur confirme" />
      </View>
      <Text style={styles.searchEta}>Cela prend en général 1 à 2 minutes.</Text>

      {message && <Text style={styles.searchMessage}>{message}</Text>}
      {loading && drivers.length === 0 && !message && (
        <Text style={styles.searchMessage}>
          On active le réseau de livreurs autour de vous…
        </Text>
      )}

      {drivers.map((driver, i) => (
        <FadeSlideIn key={driver.driverId} delay={i * 80}>
          <DriverRow driver={driver} />
        </FadeSlideIn>
      ))}
    </View>
  );
}

function StepRow({
  state,
  label,
}: {
  state: 'done' | 'active' | 'pending';
  label: string;
}) {
  return (
    <View style={styles.stepRow}>
      {state === 'active' ? (
        <ActivityIndicator color={colors.orange} size="small" style={styles.stepIcon} />
      ) : (
        <Text
          style={[
            styles.stepMark,
            state === 'done' ? styles.stepDone : styles.stepPending,
          ]}
        >
          {state === 'done' ? '✓' : '○'}
        </Text>
      )}
      <Text
        style={[
          styles.stepLabel,
          state === 'pending' && styles.stepLabelPending,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function DriverRow({ driver }: { driver: DriverCard }) {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  return (
    <Pressable
      style={styles.driverRow}
      onPress={() =>
        navigation.navigate('DriverPublic', { driverId: driver.driverId })
      }
    >
      <Text style={styles.driverEmoji}>
        {VEHICLE_EMOJI[driver.vehicleType] ?? '🏍️'}
      </Text>
      <View style={styles.flex}>
        <Text style={styles.driverName}>
          {driver.fullName ?? 'Livreur Livrechap'}
        </Text>
        <Text style={styles.driverMeta}>
          ★ {driver.ratingAverage.toFixed(1)} · {driver.totalDeliveries} livraisons
        </Text>
      </View>
      <Text style={styles.driverDistance}>
        {formatDistance(driver.distanceMeters)}
      </Text>
    </Pressable>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={styles.recapValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Une erreur est survenue.';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flex: { flex: 1 },
  content: { padding: 24 },
  searchPanel: {
    paddingVertical: 24,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    marginBottom: 20,
    paddingHorizontal: 20,
    ...shadow.card,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 18,
  },
  steps: { gap: 14, alignSelf: 'stretch' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 22 },
  stepMark: { width: 22, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  stepDone: { color: colors.success },
  stepPending: { color: colors.gray },
  stepLabel: { fontSize: 15, color: colors.navy, fontWeight: '600', flex: 1 },
  stepLabelPending: { color: colors.gray, fontWeight: '400' },
  searchEta: {
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 18,
  },
  searchMessage: {
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 12,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 12,
    width: '100%',
    gap: 12,
    ...shadow.card,
  },
  driverEmoji: { fontSize: 26 },
  driverName: { fontSize: 15, fontWeight: '600', color: colors.navy },
  driverMeta: { fontSize: 13, color: colors.gray, marginTop: 2 },
  driverDistance: { fontSize: 14, fontWeight: '600', color: colors.orange },
  banner: {
    backgroundColor: '#FFF6EF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  bannerText: {
    fontSize: 16,
    color: colors.navy,
    fontWeight: '600',
    textAlign: 'center',
  },
  codeCard: {
    backgroundColor: colors.navy,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  codeLabel: { color: colors.white, fontSize: 13, opacity: 0.8 },
  code: {
    color: colors.white,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 8,
    marginVertical: 6,
  },
  codeHint: {
    color: colors.white,
    fontSize: 12,
    opacity: 0.8,
    textAlign: 'center',
  },
  recap: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 20,
    ...shadow.card,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  recapLabel: { fontSize: 14, color: colors.gray },
  recapValue: { fontSize: 14, color: colors.navy, flex: 1, textAlign: 'right' },
  cancel: { marginTop: 4 },
  cancelLink: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelLinkText: { color: colors.gray, fontSize: 14, fontWeight: '600' },
});
