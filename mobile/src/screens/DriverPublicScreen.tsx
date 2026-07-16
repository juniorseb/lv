import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { driversApi } from '../api/drivers';
import { VehicleType } from '../api/types';
import { colors } from '../theme/colors';
import { radius, shadow } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'DriverPublic'>;

const VEHICLE_LABEL: Record<VehicleType, string> = {
  moto: '🏍️ Moto',
  voiture: '🚗 Voiture',
  velo: '🚲 Vélo',
  a_pied: '🚶 À pied',
  camionnette: '🚐 Camionnette',
};

export default function DriverPublicScreen({ route }: Props) {
  const { driverId } = route.params;
  const query = useQuery({
    queryKey: ['driver-public', driverId],
    queryFn: () => driversApi.getPublicProfile(driverId),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }
  if (query.isError || !query.data) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.muted}>Profil indisponible.</Text>
      </SafeAreaView>
    );
  }

  const d = query.data;
  const initials = (d.firstName ?? 'L').slice(0, 1).toUpperCase();
  const stars = Math.round(d.ratingAverage);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {d.selfieUrl ? (
            <Image source={{ uri: d.selfieUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{d.firstName ?? 'Livreur'}</Text>
          <Text style={styles.rating}>
            {'★'.repeat(stars)}
            <Text style={styles.ratingEmpty}>{'★'.repeat(5 - stars)}</Text>
            {'  '}
            {d.ratingAverage.toFixed(1)}
          </Text>
        </View>

        {d.badges.length > 0 && (
          <View style={styles.badges}>
            {d.badges.map((b) => (
              <View key={b.key} style={styles.badge}>
                <Text style={styles.badgeText}>✓ {b.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.stats}>
          <Stat value={String(d.totalDeliveries)} label="Livraisons" />
          <Stat value={String(d.memberSinceYear)} label="Membre depuis" />
        </View>

        <Row
          label="Véhicule"
          value={
            d.vehicleLabel
              ? `${VEHICLE_LABEL[d.vehicleType]} · ${d.vehicleLabel}`
              : VEHICLE_LABEL[d.vehicleType]
          }
        />
        {d.zones.length > 0 && (
          <Row label="Zones" value={d.zones.join(', ')} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { color: colors.gray, fontSize: 14 },
  content: { padding: 24 },
  header: { alignItems: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 34, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: colors.navy, marginTop: 12 },
  rating: { fontSize: 16, color: colors.orange, marginTop: 4 },
  ratingEmpty: { color: colors.grayLight },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
  },
  badge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { color: colors.success, fontWeight: '700', fontSize: 13 },
  stats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    alignItems: 'center',
    ...shadow.card,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.navy },
  statLabel: { fontSize: 13, color: colors.gray, marginTop: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
    paddingVertical: 14,
    marginTop: 8,
  },
  rowLabel: { fontSize: 14, color: colors.gray },
  rowValue: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
});
