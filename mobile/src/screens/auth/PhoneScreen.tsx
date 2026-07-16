import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../api/client';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Phone'>;

// Entrée dans l'app : saisie du numéro de téléphone. Écran de marque
// (« Publie. Trouve. Livre. ») fusionné avec la première étape d'auth pour
// aller vite (dossier §1 : publier/s'inscrire en quelques secondes).
export default function PhoneScreen({ navigation }: Props) {
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = phone.replace(/\D/g, '').length >= 8 && !loading;

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await requestOtp(phone.trim());
      // On navigue avec le numéro normalisé renvoyé par le backend (E.164).
      navigation.navigate('Otp', { phoneNumber: result.phoneNumber });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Impossible pour le moment. Réessayez dans quelques instants.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Image
              source={require('../../../assets/logo/icon-1024.png')}
              style={styles.logo}
            />
            <Text style={styles.title}>Livrechap</Text>
            <Text style={styles.subtitle}>Publie. Trouve. Livre.</Text>
          </View>

          <View>
            <Text style={styles.label}>Votre numéro de téléphone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="07 00 00 00 00"
              placeholderTextColor={colors.gray}
              keyboardType="phone-pad"
              autoFocus
              maxLength={20}
            />
            <Text style={styles.hint}>
              On vous envoie un code par SMS pour vous connecter.
            </Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton
              label="Continuer"
              onPress={onSubmit}
              loading={loading}
              disabled={!canSubmit}
              style={styles.submit}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: { marginBottom: 48, alignItems: 'center' },
  logo: { width: 84, height: 84, borderRadius: 20, marginBottom: 16 },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.orange,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.navy,
    textAlign: 'center',
    marginTop: 4,
  },
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
    paddingVertical: 16,
    fontSize: 20,
    color: colors.navy,
    backgroundColor: colors.white,
  },
  hint: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 10,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginTop: 14,
  },
  submit: { marginTop: 24 },
});
