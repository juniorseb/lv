import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
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

import { walletApi } from '../../api/wallet';
import { RechargeProvider } from '../../api/types';
import PrimaryButton from '../../components/PrimaryButton';
import { colors } from '../../theme/colors';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Recharge'>;

const PROVIDERS: { value: RechargeProvider; label: string }[] = [
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'wave', label: 'Wave' },
];

const QUICK_AMOUNTS = [1000, 2000, 5000];

// Recharge du Crédit Livrechap via Mobile Money (dossier §7).
export default function RechargeScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [provider, setProvider] = useState<RechargeProvider>('orange_money');

  const amountValue = Number(amount.replace(/\D/g, ''));

  const mutation = useMutation({
    mutationFn: () => walletApi.recharge(amountValue, provider),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      Alert.alert('Recharge', result.message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e: unknown) =>
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Réessayez.'),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.label}>Montant (FCFA)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
          placeholder="1000"
          placeholderTextColor={colors.gray}
          keyboardType="number-pad"
          maxLength={7}
        />
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((value) => (
            <Pressable
              key={value}
              onPress={() => setAmount(String(value))}
              style={styles.quick}
            >
              <Text style={styles.quickText}>{value}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, styles.providerLabel]}>Moyen de paiement</Text>
        <View style={styles.providerRow}>
          {PROVIDERS.map((p) => {
            const selected = provider === p.value;
            return (
              <Pressable
                key={p.value}
                onPress={() => setProvider(p.value)}
                style={[styles.provider, selected && styles.providerSelected]}
              >
                <Text
                  style={[
                    styles.providerText,
                    selected && styles.providerTextSelected,
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton
          label="Recharger"
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={amountValue <= 0}
          style={styles.submit}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  content: { padding: 24 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: 8,
  },
  providerLabel: { marginTop: 24 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 22,
    color: colors.navy,
  },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  quick: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  quickText: { color: colors.navy, fontSize: 15, fontWeight: '600' },
  providerRow: { flexDirection: 'row', gap: 12 },
  provider: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  providerSelected: { borderColor: colors.orange, backgroundColor: '#FFF6EF' },
  providerText: { fontSize: 15, fontWeight: '600', color: colors.navy },
  providerTextSelected: { color: colors.orange },
  submit: { marginTop: 32 },
});
