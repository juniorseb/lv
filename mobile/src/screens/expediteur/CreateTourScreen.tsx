import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../api/client';
import { toursApi } from '../../api/tours';
import { CreateTourStopInput } from '../../api/types';
import AddressField, { LocationValue } from '../../components/AddressField';
import PrimaryButton from '../../components/PrimaryButton';
import { colors } from '../../theme/colors';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateTour'>;

interface ItemForm {
  name: string;
  quantity: string;
  notes: string;
}

interface StopForm {
  location: LocationValue;
  recipientName: string;
  recipientPhone: string;
  price: string;
  items: ItemForm[];
}

const emptyItem = (): ItemForm => ({ name: '', quantity: '1', notes: '' });

const emptyStop = (): StopForm => ({
  location: { address: '' },
  recipientName: '',
  recipientPhone: '',
  price: '',
  items: [emptyItem()],
});

// Création d'une tournée (spec-tournees §1.2) : un point de collecte + plusieurs
// destinataires, envoyés en une seule demande. Le livreur la verra comme une
// mission unique.
export default function CreateTourScreen({ navigation }: Props) {
  const [depart, setDepart] = useState<LocationValue>({ address: '' });
  const [stops, setStops] = useState<StopForm[]>([emptyStop(), emptyStop()]);
  const [submitting, setSubmitting] = useState(false);

  const total = stops.reduce((sum, s) => sum + (parseInt(s.price, 10) || 0), 0);

  const updateStop = (i: number, patch: Partial<StopForm>) =>
    setStops((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const removeStop = (i: number) =>
    setStops((prev) => prev.filter((_, idx) => idx !== i));

  const updateItem = (si: number, ii: number, patch: Partial<ItemForm>) =>
    setStops((prev) =>
      prev.map((s, idx) =>
        idx === si
          ? {
              ...s,
              items: s.items.map((it, j) =>
                j === ii ? { ...it, ...patch } : it,
              ),
            }
          : s,
      ),
    );

  const addItem = (si: number) =>
    setStops((prev) =>
      prev.map((s, idx) =>
        idx === si ? { ...s, items: [...s.items, emptyItem()] } : s,
      ),
    );

  const removeItem = (si: number, ii: number) =>
    setStops((prev) =>
      prev.map((s, idx) =>
        idx === si
          ? { ...s, items: s.items.filter((_, j) => j !== ii) }
          : s,
      ),
    );

  const submit = async () => {
    if (depart.latitude === undefined || depart.longitude === undefined) {
      Alert.alert('Point de collecte', 'Choisissez le point de départ.');
      return;
    }
    const payload: CreateTourStopInput[] = [];
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      if (s.location.latitude === undefined || s.location.longitude === undefined) {
        Alert.alert('Arrêt ' + (i + 1), 'Choisissez une adresse valide.');
        return;
      }
      const price = parseInt(s.price, 10);
      if (!Number.isFinite(price) || price <= 0) {
        Alert.alert('Arrêt ' + (i + 1), 'Indiquez un prix de livraison.');
        return;
      }
      const items = s.items
        .filter((it) => it.name.trim().length > 0)
        .map((it) => ({
          name: it.name.trim(),
          quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
          notes: it.notes.trim() || undefined,
        }));
      payload.push({
        recipientName: s.recipientName.trim() || undefined,
        recipientPhone: s.recipientPhone.trim() || undefined,
        address: s.location.address.trim(),
        latitude: s.location.latitude,
        longitude: s.location.longitude,
        landmark: s.location.landmark?.trim() || undefined,
        priceFcfa: price,
        items: items.length > 0 ? items : undefined,
      });
    }
    if (payload.length < 2) {
      Alert.alert('Tournée', 'Une tournée nécessite au moins 2 arrêts.');
      return;
    }
    setSubmitting(true);
    try {
      const tour = await toursApi.create({
        departAddress: depart.address.trim(),
        departLatitude: depart.latitude,
        departLongitude: depart.longitude,
        stops: payload,
      });
      navigation.replace('TourDetail', { requestId: tour.requestId });
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.section}>Point de collecte</Text>
        <AddressField
          label="Départ (chez vous)"
          placeholder="Où récupérer les colis ?"
          value={depart}
          onChange={setDepart}
        />

        <Text style={styles.section}>Destinataires ({stops.length})</Text>
        {stops.map((stop, i) => (
          <View key={i} style={styles.stopCard}>
            <View style={styles.stopHeader}>
              <Text style={styles.stopTitle}>Arrêt {i + 1}</Text>
              {stops.length > 2 && (
                <Pressable onPress={() => removeStop(i)} hitSlop={8}>
                  <Text style={styles.remove}>Retirer</Text>
                </Pressable>
              )}
            </View>
            <AddressField
              label="Adresse de livraison"
              placeholder="Où livrer ?"
              value={stop.location}
              onChange={(location) => updateStop(i, { location })}
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.label}>Destinataire</Text>
                <TextInput
                  style={styles.input}
                  value={stop.recipientName}
                  onChangeText={(recipientName) => updateStop(i, { recipientName })}
                  placeholder="Nom"
                  placeholderTextColor={colors.gray}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>Téléphone</Text>
                <TextInput
                  style={styles.input}
                  value={stop.recipientPhone}
                  onChangeText={(recipientPhone) =>
                    updateStop(i, { recipientPhone })
                  }
                  placeholder="07…"
                  placeholderTextColor={colors.gray}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <Text style={styles.label}>Prix de livraison (FCFA)</Text>
            <TextInput
              style={styles.input}
              value={stop.price}
              onChangeText={(price) => updateStop(i, { price })}
              placeholder="1500"
              placeholderTextColor={colors.gray}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Articles à remettre</Text>
            {stop.items.map((item, j) => (
              <View key={j} style={styles.itemRow}>
                <TextInput
                  style={[styles.input, styles.itemName]}
                  value={item.name}
                  onChangeText={(name) => updateItem(i, j, { name })}
                  placeholder="Ex: Foutou sauce graine"
                  placeholderTextColor={colors.gray}
                />
                <TextInput
                  style={[styles.input, styles.itemQty]}
                  value={item.quantity}
                  onChangeText={(q) =>
                    updateItem(i, j, { quantity: q.replace(/\D/g, '') })
                  }
                  placeholder="1"
                  placeholderTextColor={colors.gray}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                {stop.items.length > 1 && (
                  <Pressable onPress={() => removeItem(i, j)} hitSlop={6}>
                    <Text style={styles.itemRemove}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}
            <Pressable onPress={() => addItem(i)} hitSlop={6}>
              <Text style={styles.addItemText}>+ Ajouter un article</Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          style={styles.addStop}
          onPress={() => setStops((prev) => [...prev, emptyStop()])}
        >
          <Text style={styles.addStopText}>+ Ajouter un arrêt</Text>
        </Pressable>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total proposé</Text>
          <Text style={styles.totalValue}>
            {total.toLocaleString('fr-FR')} FCFA
          </Text>
        </View>

        <PrimaryButton
          label="Publier la tournée"
          onPress={submit}
          loading={submitting}
          style={styles.submit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  content: { padding: 24 },
  section: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
    marginTop: 20,
    marginBottom: 12,
  },
  stopCard: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stopTitle: { fontSize: 15, fontWeight: '700', color: colors.orange },
  remove: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.navy,
  },
  addStop: {
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addStopText: { color: colors.orange, fontWeight: '700', fontSize: 15 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemName: { flex: 1 },
  itemQty: { width: 60, textAlign: 'center' },
  itemRemove: { color: colors.danger, fontSize: 16, fontWeight: '700', padding: 4 },
  addItemText: {
    color: colors.orange,
    fontWeight: '600',
    fontSize: 14,
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  totalLabel: { fontSize: 16, color: colors.navy },
  totalValue: { fontSize: 22, fontWeight: '800', color: colors.navy },
  submit: { marginTop: 20 },
});
