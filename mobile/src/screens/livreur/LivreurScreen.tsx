import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../api/client';
import { deliveriesApi } from '../../api/deliveries';
import { driversApi } from '../../api/drivers';
import { profilesApi } from '../../api/profiles';
import { toursApi } from '../../api/tours';
import { walletApi } from '../../api/wallet';
import { DriverProfile, MissionCard, TourFeedCard } from '../../api/types';
import FadeSlideIn from '../../components/FadeSlideIn';
import MenuDrawer from '../../components/MenuDrawer';
import MissionCountdownButton from '../../components/MissionCountdownButton';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuthStore } from '../../store/authStore';
import { getCurrentCoords } from '../../utils/location';
import { colors } from '../../theme/colors';
import { radius, shadow } from '../../theme/tokens';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Livreur'>;

export default function LivreurScreen({ navigation }: Props) {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['driver-profile'],
    queryFn: () => profilesApi.getMyDriverProfile(),
  });

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }

  // Cas limite : activeRole='livreur' impose déjà un profil livreur côté backend
  // (setActiveRole refuse sinon). Ce garde-fou renvoie vers l'onboarding.
  if (!profileQuery.data) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.subtitle}>Aucun profil livreur.</Text>
        <PrimaryButton
          label="Devenir livreur"
          onPress={() => navigation.navigate('DriverOnboarding')}
          style={{ marginTop: 16 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <DriverDashboard
      profile={profileQuery.data}
      navigation={navigation}
      onProfileChange={() =>
        queryClient.invalidateQueries({ queryKey: ['driver-profile'] })
      }
    />
  );
}

// --- Tableau de bord livreur --------------------------------------------

function DriverDashboard({
  profile,
  navigation,
  onProfileChange,
}: {
  profile: DriverProfile;
  navigation: Props['navigation'];
  onProfileChange: () => void;
}) {
  const queryClient = useQueryClient();
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [offerRouteId, setOfferRouteId] = useState<string | null>(null);
  const [offerPrice, setOfferPrice] = useState('');

  const user = useAuthStore((s) => s.user);

  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getMyWallet(),
  });

  // Activité du jour — accueil « identité pro » (Product Psychology §9).
  const todayQuery = useQuery({
    queryKey: ['driver-today'],
    queryFn: () => deliveriesApi.driverToday(),
    refetchInterval: 30000,
  });

  // Course déjà acceptée non terminée : permet de reprendre le suivi.
  const activeQuery = useQuery({
    queryKey: ['driver-active'],
    queryFn: () => deliveriesApi.activeForDriver(),
    refetchInterval: 15000,
  });

  // Tournée en cours (reprise) — présentée comme une mission unique.
  const activeTourQuery = useQuery({
    queryKey: ['tour-active'],
    queryFn: () => toursApi.active(),
    refetchInterval: 15000,
  });

  const isActif = profile.status === 'actif';
  const isAvailable = (profile?.isAvailable ?? false) && isActif;

  const missionsQuery = useQuery({
    queryKey: ['missions'],
    queryFn: () => driversApi.getMissions(),
    enabled: isAvailable,
    refetchInterval: isAvailable ? 10000 : false,
  });

  const toursFeedQuery = useQuery({
    queryKey: ['tours-feed'],
    queryFn: () => toursApi.feed(),
    enabled: isAvailable,
    refetchInterval: isAvailable ? 12000 : false,
  });

  const acceptTour = useMutation({
    mutationFn: (routeId: string) => toursApi.accept(routeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours-feed'] });
      queryClient.invalidateQueries({ queryKey: ['tour-active'] });
      navigation.navigate('TourMission');
    },
    onError: (e: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['tours-feed'] });
      Alert.alert('Tournée indisponible', e instanceof Error ? e.message : '');
    },
  });

  const proposeOffer = useMutation({
    mutationFn: ({ routeId, price }: { routeId: string; price: number }) =>
      toursApi.proposeOffer(routeId, price),
    onSuccess: () => {
      setOfferRouteId(null);
      setOfferPrice('');
      Alert.alert('Offre envoyée', 'Le client sera notifié de votre proposition.');
    },
    onError: (e: unknown) =>
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Réessayez.'),
  });

  const toggleAvailability = async (next: boolean) => {
    setTogglingAvailability(true);
    try {
      // En passant disponible, on joint la position courante.
      const coords = next ? await getCurrentCoords() : null;
      if (next && !coords) {
        Alert.alert(
          'Position requise',
          'Activez la localisation pour passer en disponible.',
        );
        return;
      }
      await driversApi.setAvailability({
        isAvailable: next,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      onProfileChange();
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Réessayez.');
    } finally {
      setTogglingAvailability(false);
    }
  };

  const acceptMutation = useMutation({
    mutationFn: (deliveryId: string) => deliveriesApi.accept(deliveryId),
    onSuccess: (delivery) => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      navigation.navigate('ActiveDelivery', { deliveryId: delivery.id });
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 403) {
        Alert.alert('Solde insuffisant', e.message, [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Recharger', onPress: () => navigation.navigate('Recharge') },
        ]);
        return;
      }
      // 409 : mission déjà prise → on rafraîchit le feed.
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      Alert.alert('Mission indisponible', e instanceof Error ? e.message : '');
    },
  });

  const missions = missionsQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
          <Text style={styles.burger}>☰</Text>
        </Pressable>
        <Text style={styles.topTitle}>Espace livreur</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={missionsQuery.isRefetching}
            onRefresh={() => missionsQuery.refetch()}
          />
        }
      >
        {/* Accueil « identité pro » : bonjour + activité du jour + statut */}
        <View style={styles.hero}>
          <Text style={styles.heroHi}>
            Bonjour {user?.fullName?.split(' ')[0] ?? ''} 👋
          </Text>
          <Text style={styles.heroToday}>Aujourd'hui</Text>
          <View style={styles.heroStats}>
            <Text style={styles.heroStat}>
              💰 {(todayQuery.data?.todayRevenueFcfa ?? 0).toLocaleString('fr-FR')}{' '}
              FCFA
            </Text>
            <Text style={styles.heroStat}>
              📦 {todayQuery.data?.todayDeliveries ?? 0} livraison
              {(todayQuery.data?.todayDeliveries ?? 0) > 1 ? 's' : ''}
            </Text>
          </View>
          <Text style={styles.heroStatus}>
            {!isActif
              ? '⏳ Compte en validation'
              : isAvailable
                ? '🟢 Disponible'
                : '⚪ Indisponible'}
          </Text>
        </View>

        {/* Reprise d'une course en cours */}
        {activeQuery.data && (
          <Pressable
            style={styles.activeBanner}
            onPress={() =>
              navigation.navigate('ActiveDelivery', {
                deliveryId: activeQuery.data!.id,
              })
            }
          >
            <Text style={styles.activeBannerText}>
              🏍️ Vous avez une course en cours — reprendre
            </Text>
          </Pressable>
        )}

        {/* Reprise d'une tournée en cours */}
        {activeTourQuery.data && (
          <Pressable
            style={styles.activeBanner}
            onPress={() => navigation.navigate('TourMission')}
          >
            <Text style={styles.activeBannerText}>
              🛵 Tournée en cours — {activeTourQuery.data.deliveredStops}/
              {activeTourQuery.data.totalStops} livrés — reprendre
            </Text>
          </Pressable>
        )}

        {/* Portefeuille */}
        <Pressable
          style={styles.walletStrip}
          onPress={() => navigation.navigate('Recharge')}
        >
          <View>
            <Text style={styles.walletLabel}>Crédit Livrechap</Text>
            <Text style={styles.walletBalance}>
              {walletQuery.data ? `${walletQuery.data.balanceFcfa} FCFA` : '—'}
            </Text>
          </View>
          <Text style={styles.walletAction}>Recharger</Text>
        </Pressable>
        {walletQuery.data?.lowBalance && (
          <Text style={styles.lowBalance}>
            Solde bas : rechargez pour continuer à accepter des missions.
          </Text>
        )}

        {/* Statut de validation : pas de disponibilité tant que non actif
            (spec-onboarding-livreur-v2 §4). */}
        {!isActif ? (
          <View
            style={[
              styles.statusCard,
              profile.status === 'suspendu' && styles.statusCardDanger,
            ]}
          >
            <Text style={styles.statusTitle}>
              {profile.status === 'suspendu'
                ? '⛔ Compte suspendu'
                : '⏳ Compte en cours de validation'}
            </Text>
            <Text style={styles.statusText}>
              {profile.status === 'suspendu'
                ? 'Votre compte livreur a été suspendu. Contactez le support pour en savoir plus.'
                : 'Notre équipe vérifie votre inscription. Vous recevrez une notification dès son activation — vous pourrez alors passer en disponible et recevoir des missions.'}
            </Text>
            {profile.zones.length > 0 && (
              <Text style={styles.statusZones}>
                Vos zones : {profile.zones.join(', ')}
              </Text>
            )}
            {profile.status === 'en_validation' && (
              <PrimaryButton
                label="Compléter mes documents"
                onPress={() => navigation.navigate('DriverDocuments')}
                style={styles.statusAction}
              />
            )}
          </View>
        ) : (
          <>
            {/* Disponibilité */}
            <View style={styles.availabilityRow}>
              <View>
                <Text style={styles.availabilityTitle}>
                  {isAvailable ? '🟢 Disponible' : '⚪ Indisponible'}
                </Text>
                <Text style={styles.availabilitySub}>
                  {isAvailable
                    ? 'Vous recevez les missions proches.'
                    : 'Passez en disponible pour voir les missions.'}
                </Text>
              </View>
              {togglingAvailability ? (
                <ActivityIndicator color={colors.orange} />
              ) : (
                <Switch
                  value={isAvailable}
                  onValueChange={toggleAvailability}
                  trackColor={{ true: colors.orange }}
                />
              )}
            </View>

            {/* Feed de missions */}
            {isAvailable && (
              <View style={styles.feed}>
                <Text style={styles.feedTitle}>Missions proches</Text>
                {missionsQuery.isLoading ? (
                  <ActivityIndicator
                    color={colors.orange}
                    style={styles.feedLoader}
                  />
                ) : missions.length === 0 ? (
                  <Text style={styles.empty}>
                    Aucune mission pour l'instant. Ça arrive vite !
                  </Text>
                ) : (
                  missions.map((mission, i) => (
                    <FadeSlideIn key={mission.deliveryId} delay={i * 80}>
                      <MissionRow
                        mission={mission}
                        accepting={acceptMutation.isPending}
                        onAccept={() =>
                          acceptMutation.mutate(mission.deliveryId)
                        }
                        // Décompte écoulé : la mission n'est plus proposable,
                        // on rafraîchit le feed pour la faire disparaître.
                        onExpire={() => missionsQuery.refetch()}
                      />
                    </FadeSlideIn>
                  ))
                )}

                {/* Tournées disponibles (spec-tournees §4.2) */}
                {(toursFeedQuery.data ?? []).length > 0 && (
                  <>
                    <Text style={[styles.feedTitle, styles.toursTitle]}>
                      Tournées disponibles
                    </Text>
                    {(toursFeedQuery.data ?? []).map((tour, i) => (
                      <FadeSlideIn key={tour.routeId} delay={i * 80}>
                        <TourRow
                          tour={tour}
                          accepting={acceptTour.isPending}
                          onAccept={() => acceptTour.mutate(tour.routeId)}
                          onPropose={() => {
                            setOfferPrice(String(tour.totalPriceFcfa));
                            setOfferRouteId(tour.routeId);
                          }}
                        />
                      </FadeSlideIn>
                    ))}
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <MenuDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
      />

      {/* Proposer un prix pour une tournée (négociation) */}
      <Modal
        visible={offerRouteId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOfferRouteId(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setOfferRouteId(null)}
        />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Proposer un prix</Text>
          <Text style={styles.modalSub}>
            Proposez votre tarif pour cette tournée. Le client décide.
          </Text>
          <TextInput
            style={styles.modalInput}
            value={offerPrice}
            onChangeText={(t) => setOfferPrice(t.replace(/\D/g, ''))}
            placeholder="Prix (FCFA)"
            placeholderTextColor={colors.gray}
            keyboardType="number-pad"
            maxLength={7}
          />
          <PrimaryButton
            label="Envoyer l'offre"
            loading={proposeOffer.isPending}
            disabled={!offerPrice || Number(offerPrice) <= 0}
            onPress={() =>
              offerRouteId &&
              proposeOffer.mutate({
                routeId: offerRouteId,
                price: Number(offerPrice),
              })
            }
            style={{ marginTop: 12 }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MissionRow({
  mission,
  accepting,
  onAccept,
  onExpire,
}: {
  mission: MissionCard;
  accepting: boolean;
  onAccept: () => void;
  onExpire: () => void;
}) {
  return (
    <View style={styles.mission}>
      <View style={styles.missionHeader}>
        <Text style={styles.missionPrice}>{mission.priceFcfa} FCFA</Text>
        {mission.packageType && (
          <Text style={styles.missionType}>{mission.packageType}</Text>
        )}
      </View>
      <Text style={styles.missionAddress} numberOfLines={1}>
        📍 {mission.pickupAddress}
      </Text>
      <Text style={styles.missionAddress} numberOfLines={1}>
        🎯 {mission.dropoffAddress}
      </Text>
      <Text style={styles.missionDistances}>
        Approche {formatDistance(mission.approachMeters)} · Course{' '}
        {formatDistance(mission.courseMeters)}
      </Text>
      <MissionCountdownButton
        expiresAt={mission.expiresAt}
        windowStartedAt={mission.windowStartedAt}
        createdAt={mission.createdAt}
        accepting={accepting}
        onAccept={onAccept}
        onExpire={onExpire}
      />
    </View>
  );
}

function TourRow({
  tour,
  accepting,
  onAccept,
  onPropose,
}: {
  tour: TourFeedCard;
  accepting: boolean;
  onAccept: () => void;
  onPropose: () => void;
}) {
  return (
    <View style={styles.mission}>
      <View style={styles.missionHeader}>
        <Text style={styles.missionPrice}>{tour.totalPriceFcfa} FCFA</Text>
        <Text style={styles.missionType}>🛵 {tour.stopCount} colis</Text>
      </View>
      <Text style={styles.difficulty}>
        Difficulté {'★'.repeat(tour.difficultyScore)}
        <Text style={styles.difficultyEmpty}>
          {'★'.repeat(5 - tour.difficultyScore)}
        </Text>
      </Text>
      <Text style={styles.missionAddress} numberOfLines={1}>
        📍 Collecte : {tour.departAddress ?? '—'}
      </Text>
      <Text style={styles.missionDistances}>
        {tour.approachMeters !== null
          ? `À ${formatDistance(Math.round(tour.approachMeters))} · `
          : ''}
        Tournée de {tour.stopCount} arrêts
      </Text>
      <PrimaryButton
        label="Accepter la tournée"
        onPress={onAccept}
        loading={accepting}
        style={styles.acceptButton}
      />
      <Pressable style={styles.proposeBtn} onPress={onPropose}>
        <Text style={styles.proposeText}>Proposer un autre prix</Text>
      </Pressable>
    </View>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { padding: 24 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  burger: { fontSize: 26, color: colors.navy },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  heroHi: { color: colors.white, fontSize: 20, fontWeight: '800' },
  heroToday: {
    color: colors.white,
    opacity: 0.7,
    fontSize: 13,
    marginTop: 10,
  },
  heroStats: { flexDirection: 'row', gap: 18, marginTop: 4 },
  heroStat: { color: colors.white, fontSize: 18, fontWeight: '700' },
  heroStatus: {
    color: colors.orange,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  activeBanner: {
    backgroundColor: colors.orange,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  activeBannerText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
  },
  statusCard: {
    marginTop: 24,
    backgroundColor: '#EAF4FB',
    borderRadius: 16,
    padding: 18,
  },
  statusCardDanger: { backgroundColor: '#FDECEA' },
  statusTitle: { fontSize: 17, fontWeight: '800', color: colors.navy },
  statusText: {
    fontSize: 14,
    color: colors.navy,
    lineHeight: 20,
    marginTop: 8,
  },
  statusZones: { fontSize: 13, color: colors.gray, marginTop: 10 },
  statusAction: { marginTop: 16 },
  walletStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 16,
    padding: 18,
  },
  walletLabel: { color: colors.white, fontSize: 13, opacity: 0.8 },
  walletBalance: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  walletAction: { color: colors.orange, fontSize: 15, fontWeight: '700' },
  lowBalance: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 8,
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  availabilityTitle: { fontSize: 18, fontWeight: '700', color: colors.navy },
  availabilitySub: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
    maxWidth: 220,
  },
  feed: { marginTop: 16 },
  feedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: 12,
  },
  toursTitle: { marginTop: 20 },
  difficulty: { fontSize: 13, color: colors.orange, marginTop: 2 },
  difficultyEmpty: { color: colors.grayLight },
  proposeBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  proposeText: { color: colors.navy, fontSize: 14, fontWeight: '600' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '35%',
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 22,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  modalSub: { fontSize: 13, color: colors.gray, marginTop: 6 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: colors.navy,
    marginTop: 16,
  },
  feedLoader: { marginTop: 20 },
  empty: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 24,
  },
  mission: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    ...shadow.card,
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  missionPrice: { fontSize: 20, fontWeight: '800', color: colors.orange },
  missionType: { fontSize: 12, color: colors.gray },
  missionAddress: { fontSize: 14, color: colors.navy, marginTop: 2 },
  missionDistances: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 8,
    marginBottom: 4,
  },
  acceptButton: { marginTop: 10 },
});
