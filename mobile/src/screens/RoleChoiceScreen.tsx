import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrimaryButton from '../components/PrimaryButton';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import type { OnboardingStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'RoleChoice'>;

// Écran affiché uniquement à la première ouverture (activeRole non défini).
// Après ce choix, l'utilisateur n'a plus jamais à re-sélectionner son rôle au
// démarrage (spec-app-navigation-roles §2) — la bascule se fait via le menu.
export default function RoleChoiceScreen({ navigation }: Props) {
  const setActiveRole = useAuthStore((s) => s.setActiveRole);
  const isDriver = useAuthStore((s) => s.user?.isDriver ?? false);
  const [loading, setLoading] = useState(false);

  const chooseClient = async () => {
    setLoading(true);
    try {
      await setActiveRole('client');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Réessayez.');
      setLoading(false);
    }
  };

  const chooseDriver = async () => {
    if (isDriver) {
      setLoading(true);
      try {
        await setActiveRole('livreur');
      } catch (e) {
        Alert.alert('Erreur', e instanceof Error ? e.message : 'Réessayez.');
        setLoading(false);
      }
      return;
    }
    navigation.navigate('DriverOnboarding');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Livrechap</Text>
          <Text style={styles.subtitle}>Je veux…</Text>
        </View>

        <PrimaryButton
          label="📦  Envoyer un colis"
          onPress={chooseClient}
          loading={loading}
          style={styles.button}
        />
        <Pressable onPress={chooseDriver} disabled={loading} style={styles.driver}>
          <Text style={styles.driverText}>🏍️  Devenir livreur</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { marginBottom: 48 },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.orange,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: colors.navy,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  button: { marginBottom: 16 },
  driver: {
    borderWidth: 1.5,
    borderColor: colors.navy,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  driverText: { color: colors.navy, fontSize: 18, fontWeight: '600' },
});
