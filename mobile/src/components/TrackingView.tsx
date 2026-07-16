import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatEta, RouteResult } from '../api/mapbox';
import { LatLng } from '../api/types';
import { colors } from '../theme/colors';
import RouteMap from './RouteMap';

type Props = {
  title: string;
  driver: LatLng | null;
  destination: LatLng | null;
  route: RouteResult | null;
};

// Panneau de suivi : carte (livreur + destination + itinéraire) surmontée d'un
// bandeau ETA. Réutilisé côté expéditeur et côté livreur.
export default function TrackingView({
  title,
  driver,
  destination,
  route,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.eta}>
          {route ? `~ ${formatEta(route.durationSeconds)}` : '…'}
        </Text>
      </View>
      <RouteMap
        driver={driver}
        destination={destination}
        route={route?.coordinates ?? null}
        style={styles.map}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.navy, flex: 1 },
  eta: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.orange,
    marginLeft: 12,
  },
  map: { height: 280 },
});
