import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { profilesApi } from '../../api/profiles';
import { VehicleType } from '../../api/types';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: 'moto', label: '🏍️ Moto' },
  { value: 'voiture', label: '🚗 Voiture' },
  { value: 'velo', label: '🚲 Vélo' },
  { value: 'a_pied', label: '🚶 À pied' },
  { value: 'camionnette', label: '🚐 Camionnette' },
];

// Communes d'Abidjan (zones de livraison). Liste simple suffisante en V1
// (spec-onboarding-livreur-v2 §1 étape 1).
const ZONES = [
  'Abobo',
  'Adjamé',
  'Attécoubé',
  'Cocody',
  'Koumassi',
  'Marcory',
  'Plateau',
  'Port-Bouët',
  'Treichville',
  'Yopougon',
  'Bingerville',
  'Anyama',
  'Songon',
];

// Onboarding livreur v2 (P0 : véhicule + zones → profil livreur « en_validation »).
// Réutilisé depuis « Je veux… » et depuis le menu « Devenir livreur ». Après
// création, le compte est en attente de validation admin : le rôle actif bascule
// sur « livreur » et l'espace livreur affiche le statut (LivreurScreen).
// À venir : documents, infos véhicule détaillées, paiement (§ suivants).
export default function DriverOnboardingScreen() {
  const setActiveRole = useAuthStore((s) => s.setActiveRole);
  const [vehicle, setVehicle] = useState<VehicleType>('moto');
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleZone = (zone: string) => {
    setZones((prev) =>
      prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone],
    );
  };

  const submit = async () => {
    if (zones.length === 0) {
      Alert.alert(
        'Zones de livraison',
        'Choisissez au moins une commune où vous livrez.',
      );
      return;
    }
    setLoading(true);
    try {
      await profilesApi.createDriverProfile(vehicle, zones);
      await setActiveRole('livreur');
      // RootNavigator bascule vers l'espace livreur ; le statut « en validation »
      // y est affiché tant que l'admin n'a pas activé le compte.
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Réessayez.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Devenez livreur</Text>
        <Text style={styles.subtitle}>
          Quelques infos et votre compte passe en validation.
        </Text>

        <Text style={styles.label}>Votre véhicule</Text>
        <View style={styles.grid}>
          {VEHICLES.map((v) => {
            const selected = vehicle === v.value;
            return (
              <Pressable
                key={v.value}
                onPress={() => setVehicle(v.value)}
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

        <Text style={styles.label}>Vos zones de livraison</Text>
        <Text style={styles.hint}>Où souhaitez-vous recevoir des courses ?</Text>
        <View style={styles.chips}>
          {ZONES.map((zone) => {
            const selected = zones.includes(zone);
            return (
              <Pressable
                key={zone}
                onPress={() => toggleZone(zone)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {zone}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            ℹ️ Après inscription, votre compte est vérifié par notre équipe. Vous
            pourrez recevoir des missions dès son activation.
          </Text>
        </View>

        <PrimaryButton
          label="Envoyer ma demande"
          onPress={submit}
          loading={loading}
          style={styles.button}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  content: { padding: 24 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
    marginTop: 16,
    marginBottom: 12,
  },
  hint: { fontSize: 13, color: colors.gray, marginTop: -8, marginBottom: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  option: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minWidth: '45%',
    alignItems: 'center',
  },
  optionSelected: { borderColor: colors.orange, backgroundColor: '#FFF6EF' },
  optionText: { fontSize: 16, color: colors.navy, fontWeight: '600' },
  optionTextSelected: { color: colors.orange },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipSelected: { borderColor: colors.orange, backgroundColor: '#FFF6EF' },
  chipText: { fontSize: 14, color: colors.navy, fontWeight: '500' },
  chipTextSelected: { color: colors.orange, fontWeight: '700' },
  notice: {
    marginTop: 24,
    backgroundColor: '#EAF4FB',
    borderRadius: 12,
    padding: 14,
  },
  noticeText: { fontSize: 13, color: colors.navy, lineHeight: 19 },
  button: { marginTop: 24 },
});
