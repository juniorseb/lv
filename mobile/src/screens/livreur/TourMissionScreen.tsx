import React, { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../api/client';
import { getRoute, RouteResult } from '../../api/mapbox';
import { toursApi } from '../../api/tours';
import { uploadImage } from '../../api/uploads';
import { ActiveTour, LatLng } from '../../api/types';
import PrimaryButton from '../../components/PrimaryButton';
import TrackingView from '../../components/TrackingView';
import ProtectControl from '../../components/ProtectControl';
import { getCurrentCoords } from '../../utils/location';
import { captureImage } from '../../utils/image';
import { colors } from '../../theme/colors';
import { radius, shadow } from '../../theme/tokens';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'TourMission'>;

const PROBLEM_REASONS: { value: string; label: string }[] = [
  { value: 'client_absent', label: 'Client absent' },
  { value: 'mauvaise_adresse', label: 'Mauvaise adresse' },
  { value: 'client_injoignable', label: 'Client injoignable' },
  { value: 'refus', label: 'Refus' },
  { value: 'article_manquant', label: 'Article manquant' },
  { value: 'mauvais_article', label: 'Mauvais article' },
  { value: 'colis_endommage', label: 'Colis endommagé' },
];

export default function TourMissionScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [collectPhoto, setCollectPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const query = useQuery({
    queryKey: ['tour-active'],
    queryFn: () => toursApi.active(),
    refetchInterval: 20000,
  });

  const invalidate = () => {
    setCode('');
    queryClient.invalidateQueries({ queryKey: ['tour-active'] });
  };

  const routeId = query.data?.routeId;

  const pickup = useMutation({
    mutationFn: () => toursApi.pickup(routeId!, collectPhoto ?? undefined),
    onSuccess: invalidate,
    onError: (e: unknown) =>
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.'),
  });

  const takeCollectPhoto = async () => {
    const uri = await captureImage();
    if (!uri) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadImage(uri);
      setCollectPhoto(url);
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const [proofPhoto, setProofPhoto] = useState<string | null>(null);

  const complete = useMutation({
    mutationFn: (stopId: string) =>
      toursApi.completeStop(stopId, code.trim(), proofPhoto ?? undefined),
    onSuccess: () => {
      setProofPhoto(null);
      invalidate();
    },
    onError: (e: unknown) =>
      Alert.alert('Code refusé', e instanceof ApiError ? e.message : 'Réessayez.'),
  });

  const takeProofPhoto = async () => {
    const uri = await captureImage();
    if (!uri) return;
    setUploadingPhoto(true);
    try {
      setProofPhoto(await uploadImage(uri));
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const problem = useMutation({
    mutationFn: ({ stopId, reason }: { stopId: string; reason: string }) =>
      toursApi.reportProblem(stopId, reason),
    onSuccess: invalidate,
    onError: (e: unknown) =>
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.'),
  });

  // Position du livreur + itinéraire Mapbox vers l'arrêt courant (notre stack
  // Mapbox — pas d'app externe). Recalculé quand l'arrêt courant change.
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const currentStopId = query.data?.currentStop?.id ?? null;
  const currentStopLoc = query.data?.currentStop?.location ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!currentStopLoc) {
      setRouteResult(null);
      return;
    }
    (async () => {
      const coords = await getCurrentCoords();
      if (cancelled) return;
      setDriverPos(coords);
      if (coords) {
        const r = await getRoute(coords, currentStopLoc);
        if (!cancelled) setRouteResult(r);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStopId]);

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }

  const tour = query.data;
  if (!tour) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.muted}>Aucune tournée active.</Text>
        <PrimaryButton
          label="Retour"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        />
      </SafeAreaView>
    );
  }

  const needsPickup = tour.stops.every((s) => s.status === 'en_attente');
  const current = tour.currentStop;
  const done = tour.status === 'terminee' || !current;

  const askProblem = (stopId: string) => {
    Alert.alert('Signaler un problème', 'Que s\'est-il passé ?', [
      ...PROBLEM_REASONS.map((r) => ({
        text: r.label,
        onPress: () => problem.mutate({ stopId, reason: r.value }),
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Progression */}
        <View style={styles.progressHead}>
          <Text style={styles.progressText}>
            Tournée · {tour.deliveredStops}/{tour.totalStops} livrés
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.round(
                    (tour.deliveredStops / Math.max(tour.totalStops, 1)) * 100,
                  )}%`,
                },
              ]}
            />
          </View>
        </View>

        {!done && (
          <View style={styles.protect}>
            <ProtectControl role="livreur" />
          </View>
        )}

        {done ? (
          <View style={styles.doneCard}>
            <Text style={styles.doneText}>
              ✅ Tournée terminée — {tour.deliveredStops}/{tour.totalStops}{' '}
              colis livrés.
            </Text>
            {tour.returnStops > 0 && (
              <View style={styles.returnBox}>
                <Text style={styles.returnText}>
                  {/* Un LIEU, pas une personne : celui qui vous a remis les
                      colis n'est pas forcément celui qui a commandé la tournée. */}
                  🔄 {tour.returnStops} colis à retourner au point de départ :{' '}
                  {tour.departAddress ?? 'point de collecte'}.
                </Text>
              </View>
            )}
            <PrimaryButton
              label="Retour au tableau de bord"
              onPress={() => navigation.goBack()}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : needsPickup ? (
          <View style={styles.pickupCard}>
            <Text style={styles.pickupTitle}>
              Récupérez les {tour.totalStops} colis
            </Text>
            <Text style={styles.pickupSub}>
              Collecte : {tour.departAddress ?? '—'}
            </Text>
            <Pressable style={styles.photoBtn} onPress={takeCollectPhoto}>
              <Text style={styles.photoBtnText}>
                {uploadingPhoto
                  ? 'Envoi…'
                  : collectPhoto
                    ? '✓ Photo des colis ajoutée'
                    : '📷 Photo des colis (preuve, optionnel)'}
              </Text>
            </Pressable>
            <PrimaryButton
              label="J'ai récupéré les colis"
              onPress={() => pickup.mutate()}
              loading={pickup.isPending}
              style={{ marginTop: 12 }}
            />
          </View>
        ) : current ? (
          <View>
            {current.location ? (
              <TrackingView
                title={`Vers l'arrêt ${current.orderIndex + 1}`}
                driver={driverPos}
                destination={current.location}
                route={routeResult}
              />
            ) : null}
            <View style={styles.currentCard}>
            <Text style={styles.currentBadge}>
              Arrêt {current.orderIndex + 1}/{tour.totalStops}
            </Text>
            <Text style={styles.currentName}>
              {current.recipientName ?? 'Destinataire'}
            </Text>
            <Text style={styles.currentAddress}>📍 {current.address}</Text>
            {current.landmark ? (
              <Text style={styles.currentLandmark}>🔎 {current.landmark}</Text>
            ) : null}
            <Text style={styles.currentPrice}>
              {current.priceFcfa.toLocaleString('fr-FR')} FCFA
            </Text>

            {current.items.length > 0 && (
              <View style={styles.itemsBox}>
                <Text style={styles.itemsTitle}>Articles à remettre</Text>
                {current.items.map((it) => (
                  <Text key={it.id} style={styles.itemLine}>
                    • {it.name} ×{it.quantity}
                    {it.notes ? (
                      <Text style={styles.itemNote}> — {it.notes}</Text>
                    ) : null}
                  </Text>
                ))}
              </View>
            )}

            {current.recipientPhone ? (
              <Pressable
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${current.recipientPhone}`)}
              >
                <Text style={styles.callText}>📞 Appeler le client</Text>
              </Pressable>
            ) : null}

            <Text style={styles.codeLabel}>Code du destinataire</Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={setCode}
              placeholder="4 chiffres"
              placeholderTextColor={colors.gray}
              keyboardType="number-pad"
              maxLength={4}
            />
            <Pressable style={styles.photoBtn} onPress={takeProofPhoto}>
              <Text style={styles.photoBtnText}>
                {uploadingPhoto
                  ? 'Envoi…'
                  : proofPhoto
                    ? '✓ Photo de livraison ajoutée'
                    : '📷 Photo de livraison (optionnel)'}
              </Text>
            </Pressable>
            <PrimaryButton
              label="Marquer comme livré"
              onPress={() => complete.mutate(current.id)}
              loading={complete.isPending}
              disabled={code.trim().length !== 4}
              style={{ marginTop: 12 }}
            />
            <Pressable
              style={styles.problemBtn}
              onPress={() => askProblem(current.id)}
            >
              <Text style={styles.problemText}>Signaler un problème</Text>
            </Pressable>
            </View>
          </View>
        ) : null}

        {/* Aperçu des arrêts restants */}
        {!done && (
          <View style={styles.list}>
            <Text style={styles.listTitle}>Ordre de la tournée</Text>
            {tour.stops.map((s) => (
              <View key={s.id} style={styles.listRow}>
                <Text style={styles.listIndex}>{s.orderIndex + 1}</Text>
                <Text style={styles.listAddress} numberOfLines={1}>
                  {s.address}
                </Text>
                <Text style={styles.listStatus}>
                  {s.status === 'livre'
                    ? '✓'
                    : s.status === 'probleme' || s.status === 'retour'
                      ? '⚠'
                      : s.status === 'en_route'
                        ? '→'
                        : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
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
    padding: 24,
  },
  muted: { color: colors.gray, fontSize: 14 },
  content: { padding: 24 },
  progressHead: { marginBottom: 20 },
  protect: { marginBottom: 20 },
  progressText: { fontSize: 15, fontWeight: '700', color: colors.navy },
  progressBar: {
    height: 8,
    backgroundColor: colors.grayLight,
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: colors.orange },
  doneCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 20,
  },
  doneText: { fontSize: 16, fontWeight: '700', color: colors.success },
  returnBox: {
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  returnText: { fontSize: 14, color: colors.danger, lineHeight: 19 },
  pickupCard: {
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 16,
    padding: 20,
  },
  pickupTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  pickupSub: { fontSize: 14, color: colors.gray, marginTop: 6 },
  photoBtn: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: colors.navy },
  currentCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 20,
    ...shadow.card,
  },
  currentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.navy,
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  currentName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
    marginTop: 12,
  },
  currentAddress: { fontSize: 15, color: colors.navy, marginTop: 8 },
  currentLandmark: { fontSize: 14, color: colors.gray, marginTop: 4 },
  currentPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.orange,
    marginTop: 10,
  },
  itemsBox: {
    backgroundColor: '#F6F7F9',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  itemsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: 6,
  },
  itemLine: { fontSize: 15, color: colors.navy, marginTop: 3 },
  itemNote: { fontSize: 13, color: colors.gray, fontStyle: 'italic' },
  callBtn: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  callText: { fontSize: 15, fontWeight: '600', color: colors.navy },
  codeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.navy,
    marginTop: 18,
    marginBottom: 6,
  },
  codeInput: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.navy,
  },
  problemBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  problemText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  list: { marginTop: 24 },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  listIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.grayLight,
    color: colors.navy,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  listAddress: { flex: 1, fontSize: 14, color: colors.navy },
  listStatus: { fontSize: 16, width: 20, textAlign: 'center' },
});
