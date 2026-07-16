import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../api/client';
import { profilesApi } from '../../api/profiles';
import { uploadImage } from '../../api/uploads';
import { VehicleType } from '../../api/types';
import PrimaryButton from '../../components/PrimaryButton';
import { captureImage, pickImage } from '../../utils/image';
import { colors } from '../../theme/colors';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'DriverVehicle'>;

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: 'moto', label: '🏍️ Moto' },
  { value: 'voiture', label: '🚗 Voiture' },
  { value: 'velo', label: '🚲 Vélo' },
  { value: 'a_pied', label: '🚶 À pied' },
  { value: 'camionnette', label: '🚐 Camionnette' },
];

type PhotoSlot = 'photoAvantUrl' | 'photoArriereUrl' | 'photoPlaqueUrl';

const PHOTO_SLOTS: { key: PhotoSlot; label: string }[] = [
  { key: 'photoAvantUrl', label: 'Avant' },
  { key: 'photoArriereUrl', label: 'Arrière' },
  { key: 'photoPlaqueUrl', label: 'Plaque' },
];

function isMotorized(type: VehicleType): boolean {
  return type === 'moto' || type === 'voiture' || type === 'camionnette';
}

export default function VehicleScreen({ navigation, route }: Props) {
  const addMode = route.params?.mode === 'add';
  const vehicleQuery = useQuery({
    queryKey: ['driver-vehicle'],
    queryFn: () => profilesApi.getVehicle(),
    enabled: !addMode,
  });

  if (!addMode && vehicleQuery.isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <VehicleForm
      navigation={navigation}
      addMode={addMode}
      initial={addMode ? null : vehicleQuery.data ?? null}
    />
  );
}

function VehicleForm({
  navigation,
  addMode,
  initial,
}: {
  navigation: Props['navigation'];
  addMode: boolean;
  initial: Awaited<ReturnType<typeof profilesApi.getVehicle>>;
}) {
  const [vehicleType, setVehicleType] = useState<VehicleType>(
    initial?.vehicleType ?? 'moto',
  );
  const [marque, setMarque] = useState(initial?.marque ?? '');
  const [modele, setModele] = useState(initial?.modele ?? '');
  const [annee, setAnnee] = useState(
    initial?.annee ? String(initial.annee) : '',
  );
  const [couleur, setCouleur] = useState(initial?.couleur ?? '');
  const [immatriculation, setImmatriculation] = useState(
    initial?.immatriculation ?? '',
  );
  const [capacite, setCapacite] = useState(
    initial?.capaciteMaxColis ? String(initial.capaciteMaxColis) : '',
  );
  const [photos, setPhotos] = useState<Record<PhotoSlot, string | null>>({
    photoAvantUrl: initial?.photoAvantUrl ?? null,
    photoArriereUrl: initial?.photoArriereUrl ?? null,
    photoPlaqueUrl: initial?.photoPlaqueUrl ?? null,
  });
  const [uploadingSlot, setUploadingSlot] = useState<PhotoSlot | null>(null);
  const [saving, setSaving] = useState(false);

  const motorized = isMotorized(vehicleType);

  const addPhoto = (slot: PhotoSlot) => {
    const handle = async (uri: string | null) => {
      if (!uri) return;
      setUploadingSlot(slot);
      try {
        const url = await uploadImage(uri);
        setPhotos((prev) => ({ ...prev, [slot]: url }));
      } catch (e) {
        Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
      } finally {
        setUploadingSlot(null);
      }
    };
    Alert.alert('Photo du véhicule', 'Comment ajouter cette photo ?', [
      { text: 'Prendre une photo', onPress: () => void captureImage().then(handle) },
      { text: 'Galerie', onPress: () => void pickImage().then(handle) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const save = async () => {
    const yr = parseInt(annee, 10);
    const payload = {
      vehicleType,
      marque: marque.trim() || undefined,
      modele: modele.trim() || undefined,
      annee: Number.isFinite(yr) ? yr : undefined,
      couleur: couleur.trim() || undefined,
      immatriculation: motorized
        ? immatriculation.trim() || undefined
        : undefined,
      capaciteMaxColis: Number.isFinite(parseInt(capacite, 10))
        ? parseInt(capacite, 10)
        : undefined,
      photoAvantUrl: photos.photoAvantUrl ?? undefined,
      photoArriereUrl: photos.photoArriereUrl ?? undefined,
      photoPlaqueUrl: photos.photoPlaqueUrl ?? undefined,
    };
    setSaving(true);
    try {
      if (addMode) {
        await profilesApi.addVehicle(payload);
      } else {
        await profilesApi.upsertVehicle(payload);
      }
      Alert.alert('Véhicule', 'Informations enregistrées.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.label}>Type de véhicule</Text>
        <View style={styles.grid}>
          {VEHICLES.map((v) => {
            const selected = vehicleType === v.value;
            return (
              <Pressable
                key={v.value}
                onPress={() => setVehicleType(v.value)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text
                  style={[styles.optionText, selected && styles.optionTextSelected]}
                >
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Marque</Text>
        <TextInput
          style={styles.input}
          value={marque}
          onChangeText={setMarque}
          placeholder="Ex: Yamaha"
          placeholderTextColor={colors.gray}
        />
        <Text style={styles.label}>Modèle</Text>
        <TextInput
          style={styles.input}
          value={modele}
          onChangeText={setModele}
          placeholder="Ex: Crux"
          placeholderTextColor={colors.gray}
        />
        <View style={styles.rowFields}>
          <View style={styles.flex}>
            <Text style={styles.label}>Année</Text>
            <TextInput
              style={styles.input}
              value={annee}
              onChangeText={setAnnee}
              placeholder="2020"
              placeholderTextColor={colors.gray}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>Couleur</Text>
            <TextInput
              style={styles.input}
              value={couleur}
              onChangeText={setCouleur}
              placeholder="Ex: Rouge"
              placeholderTextColor={colors.gray}
            />
          </View>
        </View>

        <Text style={styles.label}>Capacité (nombre de colis max)</Text>
        <TextInput
          style={styles.input}
          value={capacite}
          onChangeText={(t) => setCapacite(t.replace(/\D/g, ''))}
          placeholder="Ex: 5"
          placeholderTextColor={colors.gray}
          keyboardType="number-pad"
          maxLength={3}
        />

        {motorized && (
          <>
            <Text style={styles.label}>Immatriculation</Text>
            <TextInput
              style={styles.input}
              value={immatriculation}
              onChangeText={setImmatriculation}
              placeholder="Ex: 1234 AB 01"
              placeholderTextColor={colors.gray}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Photos du véhicule</Text>
            <View style={styles.photos}>
              {PHOTO_SLOTS.map((slot) => (
                <Pressable
                  key={slot.key}
                  style={styles.photoSlot}
                  onPress={() => addPhoto(slot.key)}
                >
                  {uploadingSlot === slot.key ? (
                    <ActivityIndicator color={colors.orange} />
                  ) : photos[slot.key] ? (
                    <Image
                      source={{ uri: photos[slot.key]! }}
                      style={styles.photoImg}
                    />
                  ) : (
                    <Text style={styles.photoPlus}>＋</Text>
                  )}
                  <Text style={styles.photoLabel}>{slot.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <PrimaryButton
          label="Enregistrer"
          onPress={save}
          loading={saving}
          style={styles.save}
        />
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
  flex: { flex: 1 },
  content: { padding: 24 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: 8,
    marginTop: 16,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionSelected: { borderColor: colors.orange, backgroundColor: '#FFF6EF' },
  optionText: { fontSize: 14, color: colors.navy, fontWeight: '600' },
  optionTextSelected: { color: colors.orange },
  input: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.navy,
  },
  rowFields: { flexDirection: 'row', gap: 12 },
  photos: { flexDirection: 'row', gap: 12 },
  photoSlot: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  photoPlus: { fontSize: 28, color: colors.gray },
  photoLabel: {
    position: 'absolute',
    bottom: 4,
    fontSize: 11,
    color: colors.navy,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  save: { marginTop: 28 },
});
