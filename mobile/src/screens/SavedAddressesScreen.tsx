import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addressesApi } from '../api/addresses';
import { ApiError } from '../api/client';
import { SavedAddress } from '../api/types';
import AddressField, { LocationValue } from '../components/AddressField';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { radius, shadow } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'SavedAddresses'>;

const EMPTY: LocationValue = { address: '' };

export default function SavedAddressesScreen(_props: Props) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [location, setLocation] = useState<LocationValue>(EMPTY);
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ['saved-addresses'],
    queryFn: () => addressesApi.list(),
  });

  const resetForm = () => {
    setAdding(false);
    setLabel('');
    setLocation(EMPTY);
  };

  const save = async () => {
    if (label.trim().length < 1) {
      Alert.alert('Nom', 'Donnez un nom à cette adresse (ex. Maison, Bureau).');
      return;
    }
    if (location.latitude === undefined || location.longitude === undefined) {
      Alert.alert(
        'Adresse',
        'Choisissez une adresse dans les suggestions ou sur la carte.',
      );
      return;
    }
    setSaving(true);
    try {
      await addressesApi.create({
        label: label.trim(),
        address: location.address.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
        landmark: location.landmark?.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['saved-addresses'] });
      resetForm();
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (addr: SavedAddress) => {
    Alert.alert('Supprimer', `Supprimer « ${addr.label} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await addressesApi.remove(addr.id);
            await queryClient.invalidateQueries({
              queryKey: ['saved-addresses'],
            });
          } catch (e) {
            Alert.alert(
              'Erreur',
              e instanceof ApiError ? e.message : 'Réessayez.',
            );
          }
        },
      },
    ]);
  };

  const addresses = query.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {query.isLoading ? (
          <ActivityIndicator color={colors.orange} style={styles.loader} />
        ) : addresses.length === 0 && !adding ? (
          <EmptyState
            emoji="📍"
            title="Aucune adresse enregistrée"
            subtitle="Ajoutez vos lieux fréquents (maison, bureau…) pour les réutiliser en un tap."
          />
        ) : (
          addresses.map((addr) => (
            <View key={addr.id} style={styles.card}>
              <View style={styles.flex}>
                <Text style={styles.cardLabel}>{addr.label}</Text>
                <Text style={styles.cardAddress} numberOfLines={2}>
                  {addr.address}
                </Text>
                {addr.landmark ? (
                  <Text style={styles.cardLandmark}>📌 {addr.landmark}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => remove(addr)} hitSlop={8}>
                <Text style={styles.delete}>Supprimer</Text>
              </Pressable>
            </View>
          ))
        )}

        {adding ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Nouvelle adresse</Text>
            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Ex. Maison, Bureau"
              placeholderTextColor={colors.gray}
            />
            <AddressField
              label="Adresse"
              placeholder="Rechercher une adresse…"
              value={location}
              onChange={setLocation}
            />
            <View style={styles.formActions}>
              <Pressable onPress={resetForm} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Annuler</Text>
              </Pressable>
              <PrimaryButton
                label="Enregistrer"
                onPress={save}
                loading={saving}
                style={styles.flex}
              />
            </View>
          </View>
        ) : (
          <PrimaryButton
            label="Ajouter une adresse"
            onPress={() => setAdding(true)}
            style={styles.add}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: 24 },
  loader: { marginTop: 24 },
  empty: { color: colors.gray, fontSize: 14, lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
  },
  cardLabel: { fontSize: 16, fontWeight: '700', color: colors.navy },
  cardAddress: { fontSize: 14, color: colors.gray, marginTop: 3 },
  cardLandmark: { fontSize: 13, color: colors.navy, marginTop: 4 },
  delete: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  add: { marginTop: 12 },
  form: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grayLight,
    paddingTop: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.navy,
    marginBottom: 8,
  },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  cancelText: { color: colors.gray, fontWeight: '600', fontSize: 15 },
});
