import React, { useEffect, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

const RESEND_COOLDOWN_SECONDS = 60;

// Saisie du code OTP reçu par SMS. La vérification réussie ouvre la session ;
// la navigation bascule alors automatiquement vers l'espace connecté
// (RootNavigator réagit au statut d'auth).
export default function OtpScreen({ route }: Props) {
  const { phoneNumber } = route.params;
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const requestOtp = useAuthStore((s) => s.requestOtp);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRef = useRef<TextInput>(null);

  const canSubmit = code.length >= 4 && !loading;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(phoneNumber, code.trim());
      // Succès : le RootNavigator affiche l'espace connecté. Rien à faire ici.
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Code incorrect.');
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    try {
      await requestOtp(phoneNumber);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setCode('');
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Renvoi impossible.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Entrez le code</Text>
          <Text style={styles.subtitle}>
            On vous a envoyé un code par SMS au {phoneNumber}.
          </Text>

          <TextInput
            ref={inputRef}
            style={styles.input}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
            placeholder="––––––"
            placeholderTextColor={colors.grayLight}
            keyboardType="number-pad"
            autoFocus
            maxLength={8}
            textAlign="center"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <PrimaryButton
            label="Se connecter"
            onPress={onSubmit}
            loading={loading}
            disabled={!canSubmit}
            style={styles.submit}
          />

          <Pressable onPress={onResend} disabled={cooldown > 0} style={styles.resend}>
            <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>
              {cooldown > 0
                ? `Renvoyer le code dans ${cooldown} s`
                : 'Renvoyer le code'}
            </Text>
          </Pressable>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    paddingVertical: 18,
    fontSize: 32,
    letterSpacing: 8,
    color: colors.navy,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginTop: 14,
    textAlign: 'center',
  },
  submit: { marginTop: 24 },
  resend: { marginTop: 20, alignItems: 'center' },
  resendText: {
    color: colors.orange,
    fontSize: 15,
    fontWeight: '600',
  },
  resendDisabled: {
    color: colors.gray,
  },
});
