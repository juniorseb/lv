import React, { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deliveriesApi } from '../../api/deliveries';
import { ApiError } from '../../api/client';
import { formatEta, getRoute, RouteResult } from '../../api/mapbox';
import { uploadImage } from '../../api/uploads';
import {
  CreateDeliveryInput,
  DeliveryUrgency,
  LocatedPoint,
  MatchingMode,
  PackageType,
} from '../../api/types';
import AddressField, { LocationValue } from '../../components/AddressField';
import PrimaryButton from '../../components/PrimaryButton';
import { PACKAGE_TYPES } from '../../constants/packageTypes';
import { useAuthStore } from '../../store/authStore';
import { pickImage } from '../../utils/image';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/tokens';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateDelivery'>;

// Publication d'une livraison (dossier §4). Le bouton principal s'intitule
// « Trouver un livreur » : il reflète le bénéfice, pas l'action technique.
export default function CreateDeliveryScreen({ navigation, route }: Props) {
  const senderPhone = useAuthStore((s) => s.user?.phoneNumber ?? '');
  const repostFrom = route.params?.repostFrom;
  const [pickup, setPickup] = useState<LocationValue>({ address: '' });
  const [dropoff, setDropoff] = useState<LocationValue>({ address: '' });
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  // Pré-rempli avec le numéro du compte : le cas le plus courant reste
  // « c'est moi qui remets le colis ». Mais rien n'est figé.
  const [pickupContactPhone, setPickupContactPhone] = useState(senderPhone);
  const [pickupContactName, setPickupContactName] = useState('');
  const [price, setPrice] = useState('');
  const [packageType, setPackageType] = useState<PackageType | undefined>();
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<MatchingMode>('rapide');
  const [urgency, setUrgency] = useState<DeliveryUrgency>('normal');
  const [schedulePreset, setSchedulePreset] = useState<string>('asap');
  const [isCod, setIsCod] = useState(false);
  const [codAmount, setCodAmount] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routePreview, setRoutePreview] = useState<RouteResult | null>(null);

  // Republication d'une course expirée : on repart de l'ancienne pour que le
  // client n'ait pas à tout ressaisir, mais rien n'est figé — il peut ajuster le
  // prix (souvent la raison de l'expiration) ou n'importe quelle info, puis
  // publier une nouvelle course.
  useEffect(() => {
    if (!repostFrom) return;
    let cancelled = false;
    deliveriesApi
      .get(repostFrom)
      .then((old) => {
        if (cancelled) return;
        setPickup({
          address: old.pickup.address,
          latitude: old.pickup.latitude,
          longitude: old.pickup.longitude,
        });
        setDropoff({
          address: old.dropoff.address,
          latitude: old.dropoff.latitude,
          longitude: old.dropoff.longitude,
        });
        setRecipientName(old.recipientName ?? '');
        setRecipientPhone(old.recipientPhone ?? '');
        setPickupContactName(old.pickupContactName ?? '');
        setPickupContactPhone(old.pickupContactPhone ?? senderPhone);
        setPrice(String(old.priceFcfa));
        setPackageType(old.packageType ?? undefined);
        setDescription(old.description ?? '');
        setUrgency(old.urgency);
        setPhotoUrl(old.photoUrl);
        setIsCod(old.isCod);
        setCodAmount(
          old.codArticleAmountFcfa ? String(old.codArticleAmountFcfa) : '',
        );
      })
      .catch(() => {
        // Pré-remplissage best-effort : en cas d'échec le client saisit à la main.
      });
    return () => {
      cancelled = true;
    };
  }, [repostFrom]);

  const onAddPhoto = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const url = await uploadImage(uri);
      setPhotoUrl(url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Envoi de la photo impossible.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Aperçu d'itinéraire (distance + durée) dès que départ et arrivée sont posés,
  // pour tout montrer AVANT de publier (Product Psychology §5 : transparence).
  useEffect(() => {
    let cancelled = false;
    if (
      pickup.latitude === undefined ||
      pickup.longitude === undefined ||
      dropoff.latitude === undefined ||
      dropoff.longitude === undefined
    ) {
      setRoutePreview(null);
      return;
    }
    getRoute(
      { latitude: pickup.latitude, longitude: pickup.longitude },
      { latitude: dropoff.latitude, longitude: dropoff.longitude },
    ).then((r) => {
      if (!cancelled) setRoutePreview(r);
    });
    return () => {
      cancelled = true;
    };
  }, [pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude]);

  const priceValue = Number(price.replace(/\D/g, ''));
  const pickupReady = pickup.latitude !== undefined && pickup.longitude !== undefined;
  const dropoffReady =
    dropoff.latitude !== undefined && dropoff.longitude !== undefined;
  const canSubmit =
    pickupReady &&
    dropoffReady &&
    recipientPhone.replace(/\D/g, '').length >= 8 &&
    priceValue > 0 &&
    !submitting;

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const pickupPoint = resolveLocation(pickup, 'de récupération');
      const dropoffPoint = resolveLocation(dropoff, 'de destination');

      const input: CreateDeliveryInput = {
        pickup: pickupPoint,
        dropoff: dropoffPoint,
        recipientName: recipientName.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
        pickupContactName: pickupContactName.trim() || undefined,
        pickupContactPhone: pickupContactPhone.trim() || undefined,
        // Les repères sont portés par chaque adresse (saisis dans le champ ou
        // dans le sélecteur de carte — même valeur).
        pickupNote: pickup.landmark?.trim() || undefined,
        dropoffNote: dropoff.landmark?.trim() || undefined,
        priceFcfa: priceValue,
        packageType,
        description: description.trim() || undefined,
        photoUrl: photoUrl ?? undefined,
        matchingMode: mode,
        urgency,
        scheduledAt: computeScheduledAt(schedulePreset),
        isCod,
        codArticleAmountFcfa: isCod
          ? Number(codAmount.replace(/\D/g, '')) || 0
          : undefined,
      };

      const delivery = await deliveriesApi.create(input);
      navigation.replace('DeliverySearch', { deliveryId: delivery.id });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Impossible pour le moment. Réessayez dans quelques instants.',
      );
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          // Fait remonter le champ focalisé au-dessus du clavier (repère, prix…).
          automaticallyAdjustKeyboardInsets
        >
          {repostFrom && (
            <View style={styles.repostBanner}>
              <Text style={styles.repostText}>
                🔄 Nouvelle tentative — vos informations sont pré-remplies.
                Augmenter un peu le prix attire souvent un livreur plus vite.
              </Text>
            </View>
          )}
          <AddressField
            label="Point de récupération"
            placeholder="Où récupérer le colis ?"
            value={pickup}
            onChange={setPickup}
          />
          <AddressField
            label="Destination"
            placeholder="Où livrer le colis ?"
            value={dropoff}
            onChange={setDropoff}
          />

          {/* La « précision pour le livreur » n'est plus un champ isolé : elle
              est attachée à chaque adresse (« Ajouter un repère » sous le champ
              ou dans le sélecteur de carte), car le livreur doit trouver le
              point de récupération autant que celui de livraison. */}

          {/* Contact au point de récupération : pré-rempli avec le numéro du
              compte (cas courant) mais MODIFIABLE — on commande souvent pour
              quelqu'un d'autre, et c'est cette personne que le livreur doit
              appeler en arrivant au retrait, pas le titulaire du compte. */}
          <View style={styles.field}>
            <Text style={styles.label}>Contact au point de récupération</Text>
            <TextInput
              style={styles.input}
              value={pickupContactPhone}
              onChangeText={setPickupContactPhone}
              placeholder="07 00 00 00 00"
              placeholderTextColor={colors.gray}
              keyboardType="phone-pad"
              maxLength={20}
            />
            <Text style={styles.hint}>
              Qui remet le colis ? Par défaut vous. Changez-le si vous commandez
              pour quelqu'un d'autre.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Nom de cette personne (optionnel)
            </Text>
            <TextInput
              style={styles.input}
              value={pickupContactName}
              onChangeText={setPickupContactName}
              placeholder="Ex: Awa"
              placeholderTextColor={colors.gray}
              maxLength={150}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Numéro du destinataire</Text>
            <TextInput
              style={styles.input}
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              placeholder="07 00 00 00 00"
              placeholderTextColor={colors.gray}
              keyboardType="phone-pad"
              maxLength={20}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nom du destinataire (optionnel)</Text>
            <TextInput
              style={styles.input}
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="Ex: Awa K."
              placeholderTextColor={colors.gray}
              maxLength={150}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Prix proposé (FCFA)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={(t) => setPrice(t.replace(/\D/g, ''))}
              placeholder="1500"
              placeholderTextColor={colors.gray}
              keyboardType="number-pad"
              maxLength={7}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Type de colis</Text>
            <View style={styles.chips}>
              {PACKAGE_TYPES.map((type) => {
                const selected = packageType === type.value;
                return (
                  <Pressable
                    key={type.value}
                    onPress={() =>
                      setPackageType(selected ? undefined : type.value)
                    }
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Ex: enveloppe A4, fragile…"
              placeholderTextColor={colors.gray}
              multiline
              maxLength={1000}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Photo du colis (optionnel)</Text>
            <Pressable
              style={styles.photoBox}
              onPress={onAddPhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator color={colors.orange} />
              ) : photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photo} />
              ) : (
                <Text style={styles.photoHint}>📷 Ajouter une photo</Text>
              )}
            </Pressable>
            {photoUrl && !uploadingPhoto && (
              <Pressable onPress={() => setPhotoUrl(null)} hitSlop={8}>
                <Text style={styles.photoRemove}>Retirer la photo</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Comment trouver votre livreur ?</Text>
            <View style={styles.modeRow}>
              <ModeOption
                title="Le plus rapide"
                subtitle="Le premier livreur disponible"
                selected={mode === 'rapide'}
                onPress={() => setMode('rapide')}
              />
              <ModeOption
                title="Je choisis"
                subtitle="Comparer les livreurs proches"
                selected={mode === 'choix'}
                onPress={() => setMode('choix')}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Urgence</Text>
            <View style={styles.chips}>
              {(
                [
                  { value: 'normal', label: 'Normal' },
                  { value: 'urgent', label: '⚡ Urgent' },
                  { value: 'express', label: '🚀 Express' },
                ] as { value: DeliveryUrgency; label: string }[]
              ).map((u) => {
                const selected = urgency === u.value;
                return (
                  <Pressable
                    key={u.value}
                    onPress={() => setUrgency(u.value)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text
                      style={[styles.chipText, selected && styles.chipTextSelected]}
                    >
                      {u.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Quand livrer ?</Text>
            <View style={styles.chips}>
              {SCHEDULE_PRESETS.map((p) => {
                const selected = schedulePreset === p.value;
                return (
                  <Pressable
                    key={p.value}
                    onPress={() => setSchedulePreset(p.value)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text
                      style={[styles.chipText, selected && styles.chipTextSelected]}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Pressable
              style={styles.codToggle}
              onPress={() => setIsCod((v) => !v)}
            >
              <View style={[styles.checkbox, isCod && styles.checkboxOn]}>
                {isCod && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <View style={styles.flex}>
                <Text style={styles.codTitle}>Paiement à la réception</Text>
                <Text style={styles.codSub}>
                  Le livreur collecte le prix de l'article auprès du destinataire.
                </Text>
              </View>
            </Pressable>
            {isCod && (
              <TextInput
                style={[styles.input, styles.codInput]}
                value={codAmount}
                onChangeText={(t) => setCodAmount(t.replace(/\D/g, ''))}
                placeholder="Montant de l'article (FCFA)"
                placeholderTextColor={colors.gray}
                keyboardType="number-pad"
                maxLength={9}
              />
            )}
          </View>

          {/* Récap transparent : tout est visible avant de publier (§5). */}
          {pickupReady && dropoffReady && (
            <View style={styles.recap}>
              <Text style={styles.recapRoute} numberOfLines={1}>
                {shortAddress(pickup.address)} → {shortAddress(dropoff.address)}
              </Text>
              <View style={styles.recapRow}>
                <Text style={styles.recapMeta}>
                  {routePreview
                    ? `${(routePreview.distanceMeters / 1000).toFixed(1)} km · ~${formatEta(routePreview.durationSeconds)}`
                    : 'Estimation du trajet…'}
                </Text>
                <Text style={styles.recapPrice}>
                  {priceValue > 0
                    ? `${priceValue.toLocaleString('fr-FR')} FCFA`
                    : '— FCFA'}
                </Text>
              </View>
              <Text style={styles.recapUrgency}>
                {urgency === 'express'
                  ? 'Livraison express'
                  : urgency === 'urgent'
                    ? 'Livraison urgente'
                    : 'Livraison normale'}
                {schedulePreset !== 'asap' ? ' · programmée' : ''}
                {isCod ? ' · paiement à la réception' : ''}
              </Text>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <PrimaryButton
            label="Trouver un livreur"
            onPress={onSubmit}
            loading={submitting}
            disabled={!canSubmit}
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ModeOption({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeOption, selected && styles.modeOptionSelected]}
    >
      <Text style={[styles.modeTitle, selected && styles.modeTitleSelected]}>
        {title}
      </Text>
      <Text style={styles.modeSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

// Préréglages de programmation (spec-tournees §2). Sans dépendance de date-picker
// natif : des créneaux concrets qui couvrent les cas réels (« demain à 10h »).
const SCHEDULE_PRESETS: { value: string; label: string }[] = [
  { value: 'asap', label: 'Dès que possible' },
  { value: '1h', label: 'Dans 1h' },
  { value: '3h', label: 'Dans 3h' },
  { value: 'tomorrow_am', label: 'Demain 8h' },
  { value: 'tomorrow_pm', label: 'Demain 14h' },
];

function computeScheduledAt(preset: string): string | undefined {
  const now = new Date();
  switch (preset) {
    case '1h':
      return new Date(now.getTime() + 3600_000).toISOString();
    case '3h':
      return new Date(now.getTime() + 3 * 3600_000).toISOString();
    case 'tomorrow_am': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
      return d.toISOString();
    }
    case 'tomorrow_pm': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(14, 0, 0, 0);
      return d.toISOString();
    }
    default:
      return undefined; // « asap » : pas de programmation
  }
}

// Adresse raccourcie pour le récap (premier segment avant la virgule).
function shortAddress(address: string): string {
  const first = address.split(',')[0]?.trim() ?? address;
  return first.length > 24 ? first.slice(0, 24) + '…' : first;
}

// Les coordonnées viennent obligatoirement d'une suggestion, du GPS ou de la
// carte (choix « dans les suggestions »).
function resolveLocation(value: LocationValue, label: string): LocatedPoint {
  if (value.latitude === undefined || value.longitude === undefined) {
    throw new Error(
      `Choisis l'adresse ${label} dans les suggestions ou sur la carte.`,
    );
  }
  return {
    address: value.address,
    latitude: value.latitude,
    longitude: value.longitude,
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  codToggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  checkboxMark: { color: colors.white, fontWeight: '800', fontSize: 15 },
  codTitle: { fontSize: 15, fontWeight: '600', color: colors.navy },
  codSub: { fontSize: 12, color: colors.gray, marginTop: 2 },
  codInput: { marginTop: 12 },
  content: { padding: 24, paddingBottom: 40 },
  repostBanner: {
    backgroundColor: '#FFF6EF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.orange,
    padding: 14,
    marginBottom: 20,
  },
  repostText: { color: colors.navy, fontSize: 13, lineHeight: 19 },
  field: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.navy,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.gray, marginTop: 6, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: {
    borderColor: colors.orange,
    backgroundColor: colors.orange,
  },
  chipText: { color: colors.navy, fontSize: 14, fontWeight: '500' },
  chipTextSelected: { color: colors.white },
  modeRow: { flexDirection: 'row', gap: 12 },
  modeOption: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    padding: 14,
  },
  modeOptionSelected: {
    borderColor: colors.orange,
    backgroundColor: '#FFF6EF',
  },
  modeTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  modeTitleSelected: { color: colors.orange },
  modeSubtitle: { fontSize: 12, color: colors.gray, marginTop: 2 },
  photoBox: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoHint: { color: colors.gray, fontSize: 15 },
  photoRemove: { color: colors.danger, fontSize: 13, marginTop: 8 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  submit: { marginTop: 8 },
  recap: {
    backgroundColor: '#F6F7F9',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  recapRoute: { fontSize: 16, fontWeight: '700', color: colors.navy },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  recapMeta: { fontSize: 14, color: colors.gray },
  recapPrice: { fontSize: 18, fontWeight: '800', color: colors.orange },
  recapUrgency: { fontSize: 13, color: colors.navy, marginTop: 6 },
});

