import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { messagesApi } from '../api/messages';
import { callNumber } from '../utils/call';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';

// Barre de communication d'une mission (spec-communication §3/§16) : Appeler
// (composeur natif, confirmation au 1er appel) + Message (conversation).
// À n'afficher que pendant une mission active.
//
// L'interlocuteur DÉPEND DE LA PHASE : en allant récupérer le colis, le livreur
// joint la personne sur place (pas forcément le titulaire du compte) ; ensuite
// c'est le client. Le statut fait donc partie de la clé de cache, sinon le
// numéro resterait figé sur celui de la phase précédente.
export default function MissionComms({
  deliveryId,
  status,
}: {
  deliveryId: string;
  status: string;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const contact = useQuery({
    queryKey: ['mission-contact', deliveryId, status],
    queryFn: () => messagesApi.contact(deliveryId),
    retry: false,
  });

  const name = contact.data?.name ?? 'votre interlocuteur';

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.btn, styles.call]}
        disabled={!contact.data?.phone}
        onPress={() =>
          contact.data?.phone && callNumber(contact.data.phone, name)
        }
      >
        {/* On nomme l'interlocuteur : après le 1er appel il n'y a plus de
            confirmation, et le destinataire change selon la phase. */}
        <Text style={styles.callText}>
          {contact.data?.name ? `📞 Appeler ${contact.data.name}` : '📞 Appeler'}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.btn, styles.msg]}
        onPress={() => navigation.navigate('Conversation', { deliveryId })}
      >
        <Text style={styles.msgText}>💬 Message</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  btn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  call: { backgroundColor: colors.navy },
  callText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  msg: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
  msgText: { color: colors.navy, fontWeight: '700', fontSize: 15 },
});
