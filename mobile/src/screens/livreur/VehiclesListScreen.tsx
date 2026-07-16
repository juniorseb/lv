import React, { useCallback } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../api/client';
import { profilesApi } from '../../api/profiles';
import { Vehicle, VehicleType } from '../../api/types';
import PrimaryButton from '../../components/PrimaryButton';
import { colors } from '../../theme/colors';
import { radius, shadow } from '../../theme/tokens';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'DriverVehicles'>;

const VEHICLE_LABEL: Record<VehicleType, string> = {
  moto: '🏍️ Moto',
  voiture: '🚗 Voiture',
  velo: '🚲 Vélo',
  a_pied: '🚶 À pied',
  camionnette: '🚐 Camionnette',
};

function describe(v: Vehicle): string {
  const details = [v.marque, v.modele, v.annee, v.couleur]
    .filter(Boolean)
    .join(' · ');
  return details || VEHICLE_LABEL[v.vehicleType];
}

export default function VehiclesListScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['driver-vehicles'],
    queryFn: () => profilesApi.listVehicles(),
  });

  // Rafraîchit à chaque retour sur l'écran (après ajout/édition).
  useFocusEffect(
    useCallback(() => {
      query.refetch();
    }, [query]),
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['driver-vehicles'] });
    queryClient.invalidateQueries({ queryKey: ['driver-vehicle'] });
    queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
  };

  const activate = async (id: string) => {
    try {
      await profilesApi.activateVehicle(id);
      refresh();
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
    }
  };

  const remove = (v: Vehicle) => {
    Alert.alert('Supprimer', `Supprimer ${describe(v)} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await profilesApi.deleteVehicle(v.id);
            refresh();
          } catch (e) {
            Alert.alert(
              'Erreur',
              e instanceof ApiError ? e.message : 'Réessayez.',
            );
          }
        },
      },
    ]);
  };

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }

  const vehicles = query.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {vehicles.length === 0 ? (
          <Text style={styles.empty}>Aucun véhicule enregistré.</Text>
        ) : (
          vehicles.map((v) => (
            <View key={v.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{describe(v)}</Text>
                {v.isActive && <Text style={styles.activeBadge}>Actif</Text>}
              </View>
              <Text style={styles.cardSub}>
                {VEHICLE_LABEL[v.vehicleType]}
                {v.immatriculation ? ` · ${v.immatriculation}` : ''}
              </Text>
              <View style={styles.cardActions}>
                {!v.isActive && (
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() => activate(v.id)}
                  >
                    <Text style={styles.smallBtnText}>Activer</Text>
                  </Pressable>
                )}
                {v.isActive && (
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() => navigation.navigate('DriverVehicle')}
                  >
                    <Text style={styles.smallBtnText}>Modifier</Text>
                  </Pressable>
                )}
                {vehicles.length > 1 && (
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() => remove(v)}
                  >
                    <Text style={[styles.smallBtnText, styles.danger]}>
                      Supprimer
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}

        <PrimaryButton
          label="Ajouter un véhicule"
          onPress={() => navigation.navigate('DriverVehicle', { mode: 'add' })}
          style={styles.add}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 24 },
  empty: { color: colors.gray, fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    ...shadow.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.navy, flex: 1 },
  activeBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardSub: { fontSize: 13, color: colors.gray, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 12 },
  smallBtn: { paddingVertical: 4 },
  smallBtnText: { fontSize: 14, fontWeight: '700', color: colors.orange },
  danger: { color: colors.danger },
  add: { marginTop: 8 },
});
