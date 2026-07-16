import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
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

import { ApiError } from '../../api/client';
import { profilesApi } from '../../api/profiles';
import { MobileMoneyOperator } from '../../api/types';
import PrimaryButton from '../../components/PrimaryButton';
import { colors } from '../../theme/colors';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'DriverMobileMoney'>;

const OPERATORS: { value: MobileMoneyOperator; label: string }[] = [
  { value: 'orange', label: '🟠 Orange Money' },
  { value: 'mtn', label: '🟡 MTN MoMo' },
  { value: 'moov', label: '🔵 Moov Money' },
  { value: 'wave', label: '💙 Wave' },
];

export default function MobileMoneyScreen({ navigation }: Props) {
  const profileQuery = useQuery({
    queryKey: ['driver-profile'],
    queryFn: () => profilesApi.getMyDriverProfile(),
  });

  const profile = profileQuery.data;
  const [operator, setOperator] = useState<MobileMoneyOperator>(
    profile?.mobileMoneyOperator ?? 'orange',
  );
  const [number, setNumber] = useState(profile?.mobileMoneyNumber ?? '');
  const [holder, setHolder] = useState(profile?.mobileMoneyHolder ?? '');
  const [saving, setSaving] = useState(false);

  // Réinitialise le formulaire une fois le profil chargé (les valeurs par défaut
  // ci-dessus sont calculées avant que la requête n'ait abouti).
  const [hydrated, setHydrated] = useState(false);
  if (profile && !hydrated) {
    setHydrated(true);
    if (profile.mobileMoneyOperator) setOperator(profile.mobileMoneyOperator);
    setNumber(profile.mobileMoneyNumber ?? '');
    setHolder(profile.mobileMoneyHolder ?? '');
  }

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }

  const save = async () => {
    if (!/^\+?\d{8,15}$/.test(number.trim())) {
      Alert.alert('Numéro', 'Entrez un numéro mobile money valide.');
      return;
    }
    if (holder.trim().length < 2) {
      Alert.alert('Titulaire', 'Indiquez le nom du titulaire du compte.');
      return;
    }
    setSaving(true);
    try {
      await profilesApi.setMobileMoney(operator, number.trim(), holder.trim());
      Alert.alert('Compte de versement', 'Informations enregistrées.', [
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
        <Text style={styles.help}>
          Le compte mobile money depuis lequel vous versez et rechargez votre
          caution. Le client vous paie directement (en espèces) pour chaque
          course — la plateforme ne vous verse rien.
        </Text>

        <Text style={styles.label}>Opérateur</Text>
        <View style={styles.grid}>
          {OPERATORS.map((o) => {
            const selected = operator === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => setOperator(o.value)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text
                  style={[styles.optionText, selected && styles.optionTextSelected]}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Numéro mobile money</Text>
        <TextInput
          style={styles.input}
          value={number}
          onChangeText={setNumber}
          placeholder="Ex: 0707070707"
          placeholderTextColor={colors.gray}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Titulaire du compte</Text>
        <TextInput
          style={styles.input}
          value={holder}
          onChangeText={setHolder}
          placeholder="Nom complet du titulaire"
          placeholderTextColor={colors.gray}
        />

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
  content: { padding: 24 },
  help: { fontSize: 14, color: colors.gray, lineHeight: 20 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: 8,
    marginTop: 20,
  },
  grid: { gap: 10 },
  option: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionSelected: { borderColor: colors.orange, backgroundColor: '#FFF6EF' },
  optionText: { fontSize: 15, color: colors.navy, fontWeight: '600' },
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
  save: { marginTop: 28 },
});
