import React, { useEffect, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
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

import { ApiError } from '../api/client';
import { messagesApi } from '../api/messages';
import { MessageItem } from '../api/types';
import EmptyState, { ErrorState, LoadingState } from '../components/EmptyState';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { radius, shadow } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Conversation'>;

// Messages rapides selon le rôle (spec-communication §8) — l'essentiel des
// échanges d'une livraison, en un clic.
const QUICK: Record<'client' | 'livreur', string[]> = {
  client: [
    "J'arrive.",
    'Merci de patienter.',
    'Le portail est ouvert.',
    'Appelez-moi.',
    'Je suis à l\'intérieur.',
  ],
  livreur: [
    'Je suis arrivé.',
    'Je suis devant.',
    'Je cherche votre adresse.',
    'Je serai là dans 5 minutes.',
    'Merci de répondre.',
  ],
};

export default function ConversationScreen({ route }: Props) {
  const { deliveryId } = route.params;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = user?.activeRole === 'livreur' ? 'livreur' : 'client';
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const query = useQuery({
    queryKey: ['conversation', deliveryId],
    queryFn: () => messagesApi.conversation(deliveryId),
    refetchInterval: 4000,
  });

  const send = useMutation({
    mutationFn: (body: string) => messagesApi.send(deliveryId, body),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['conversation', deliveryId] });
    },
    onError: (e: unknown) =>
      Alert.alert(
        'Envoi impossible',
        e instanceof ApiError ? e.message : 'Réessayez.',
      ),
  });

  const messages = query.data?.messages ?? [];
  const canSend = query.data?.canSend ?? false;
  const closed = query.data?.closed ?? false;

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length]);

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState label="Chargement de la conversation…" />
      </SafeAreaView>
    );
  }
  if (query.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState onRetry={() => query.refetch()} />
      </SafeAreaView>
    );
  }
  // Mission finie/annulée : la conversation est fermée et disparaît (plus de
  // lecture des anciens messages — spec-communication « Règle fondamentale »).
  if (closed) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          emoji="🔒"
          title="Conversation fermée"
          subtitle="La mission est terminée. Les échanges ne sont plus accessibles ici."
        />
      </SafeAreaView>
    );
  }

  const submit = (body: string) => {
    const text = body.trim();
    if (!text || send.isPending) return;
    send.mutate(text);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <EmptyState
              emoji="💬"
              title="Commencez la conversation"
              subtitle={`Exemple : « ${QUICK[role][0]} »`}
            />
          ) : (
            messages.map((m: MessageItem) => {
              const mine = m.senderId === user?.id;
              return (
                <View
                  key={m.id}
                  style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowOther]}
                >
                  <View style={[styles.bubble, mine ? styles.mine : styles.other]}>
                    <Text style={mine ? styles.mineText : styles.otherText}>
                      {m.body}
                    </Text>
                    <Text style={mine ? styles.mineTime : styles.otherTime}>
                      {formatTime(m.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {canSend ? (
          <View style={styles.composer}>
            {/* Messages rapides — un clic (§8) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickRow}
              keyboardShouldPersistTaps="handled"
            >
              {QUICK[role].map((q) => (
                <Pressable
                  key={q}
                  style={styles.quickChip}
                  onPress={() => submit(q)}
                >
                  <Text style={styles.quickText}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Écrire un message…"
                placeholderTextColor={colors.gray}
                multiline
                maxLength={1000}
              />
              <Pressable
                style={[styles.sendBtn, !draft.trim() && styles.sendDisabled]}
                onPress={() => submit(draft)}
                disabled={!draft.trim() || send.isPending}
              >
                {send.isPending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.sendText}>Envoyer</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.readonly}>
            <Text style={styles.readonlyText}>
              Conversation terminée — lecture seule.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  messages: { padding: 16, gap: 8, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, padding: 12 },
  mine: { backgroundColor: colors.orange, borderBottomRightRadius: 4 },
  other: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    ...shadow.card,
  },
  mineText: { color: colors.white, fontSize: 15 },
  otherText: { color: colors.navy, fontSize: 15 },
  mineTime: { color: colors.white, opacity: 0.8, fontSize: 11, marginTop: 4, textAlign: 'right' },
  otherTime: { color: colors.gray, fontSize: 11, marginTop: 4, textAlign: 'right' },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.grayLight,
    backgroundColor: colors.white,
    paddingTop: 8,
  },
  quickRow: { paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  quickChip: {
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickText: { color: colors.navy, fontSize: 13, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.navy,
  },
  sendBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  readonly: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.grayLight,
    alignItems: 'center',
  },
  readonlyText: { color: colors.gray, fontSize: 14 },
});
