import React, { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { sosApi } from '../api/sos';
import SosButton from './SosButton';
import { getCurrentCoords } from '../utils/location';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/tokens';

// Livrechap Protect (SOS) — se place pendant une mission active, aussi bien côté
// livreur que client. Deux états :
//  • repos : bouton SOS (appui long 3 s).
//  • alerte active : bannière « support alerté, position partagée » + partage de
//    position périodique + bouton « Je suis en sécurité » pour clôturer.
const SHARE_MS = 15000;

export default function ProtectControl({
  role,
  deliveryId,
}: {
  role: 'client' | 'livreur';
  deliveryId?: string;
}) {
  const qc = useQueryClient();

  const active = useQuery({
    queryKey: ['sos-active'],
    queryFn: () => sosApi.myActive(),
    refetchInterval: 20000,
  });

  const isActive = !!active.data;

  const trigger = useMutation({
    mutationFn: async () => {
      const coords = await getCurrentCoords();
      if (!coords) {
        throw new Error('no-coords');
      }
      return sosApi.trigger(role, coords.latitude, coords.longitude, deliveryId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sos-active'] });
    },
    onError: () =>
      Alert.alert(
        'Position indisponible',
        "Impossible d'obtenir votre position. Activez la localisation puis réessayez.",
      ),
  });

  const resolve = useMutation({
    mutationFn: () => sosApi.resolve(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sos-active'] }),
  });

  // Partage de position tant que l'alerte est active.
  useEffect(() => {
    if (!isActive) {
      return;
    }
    let cancelled = false;
    const share = async () => {
      const coords = await getCurrentCoords();
      if (coords && !cancelled) {
        sosApi.updateLocation(coords.latitude, coords.longitude).catch(() => {});
      }
    };
    share();
    const id = setInterval(share, SHARE_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isActive]);

  if (isActive) {
    return (
      <View style={styles.activeCard}>
        <View style={styles.activeHead}>
          <View style={styles.dot} />
          <Text style={styles.activeTitle}>SOS actif</Text>
        </View>
        <Text style={styles.activeText}>
          Le support Livrechap est alerté et votre position est partagée en
          temps réel. Restez en ligne — de l'aide arrive.
        </Text>
        <Pressable
          style={styles.safeBtn}
          disabled={resolve.isPending}
          onPress={() =>
            Alert.alert('Tout va bien ?', 'Confirmer que vous êtes en sécurité.', [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Je suis en sécurité',
                onPress: () => resolve.mutate(),
              },
            ])
          }
        >
          <Text style={styles.safeText}>
            {resolve.isPending ? '…' : '✓ Je suis en sécurité'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return <SosButton onTrigger={() => trigger.mutate()} loading={trigger.isPending} />;
}

const styles = StyleSheet.create({
  activeCard: {
    backgroundColor: '#FDECEC',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.danger,
    padding: space.md,
    gap: space.sm,
  },
  activeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger },
  activeTitle: { color: colors.danger, fontWeight: '800', fontSize: 16 },
  activeText: { color: colors.navy, fontSize: 13, lineHeight: 19 },
  safeBtn: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  safeText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
