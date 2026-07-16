import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import type { AppStackParamList } from '../navigation/types';

const WIDTH = Math.min(320, Dimensions.get('window').width * 0.82);

// Type minimal : le menu n'a besoin que de naviguer, quel que soit l'écran hôte.
type Nav = { navigate: (screen: keyof AppStackParamList) => void };

// Menu hamburger commun aux deux rôles (spec-app-navigation-roles §3).
// Panneau latéral glissant, sans dépendance de navigation Drawer native.
export default function MenuDrawer({
  visible,
  onClose,
  navigation,
}: {
  visible: boolean;
  onClose: () => void;
  navigation: Nav;
}) {
  const user = useAuthStore((s) => s.user);
  const setActiveRole = useAuthStore((s) => s.setActiveRole);
  const logout = useAuthStore((s) => s.logout);
  const tx = useRef(new Animated.Value(-WIDTH)).current;

  useEffect(() => {
    Animated.timing(tx, {
      toValue: visible ? 0 : -WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, tx]);

  const activeRole = user?.activeRole ?? 'client';
  const isDriver = user?.isDriver ?? false;
  const name = user?.fullName?.trim() || user?.phoneNumber || 'Mon compte';
  const initials = (user?.fullName?.trim() || 'L')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const go = (screen: keyof AppStackParamList) => {
    onClose();
    navigation.navigate(screen);
  };

  const switchRole = async () => {
    onClose();
    if (activeRole === 'livreur') {
      await setActiveRole('client');
    } else if (isDriver) {
      await setActiveRole('livreur');
    } else {
      navigation.navigate('DriverOnboarding');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.panel, { transform: [{ translateX: tx }] }]}>
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          {/* Profil */}
          <Pressable style={styles.profile} onPress={() => go('Verification')}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.role}>
                {activeRole === 'livreur' ? 'Livreur' : 'Client'} · Voir mon profil
              </Text>
            </View>
          </Pressable>

          <View style={styles.divider} />

          {/* Bascule de rôle */}
          <MenuItem
            icon="🔄"
            label={
              activeRole === 'livreur'
                ? 'Passer en mode Client'
                : isDriver
                  ? 'Passer en mode Livreur'
                  : 'Devenir livreur'
            }
            onPress={switchRole}
          />

          <View style={styles.divider} />

          {/* Historique du rôle actif */}
          <MenuItem
            icon="📦"
            label={
              activeRole === 'livreur'
                ? 'Historique des livraisons'
                : 'Historique des expéditions'
            }
            onPress={() =>
              go(activeRole === 'livreur' ? 'DriverHistory' : 'ClientHistory')
            }
          />

          {activeRole === 'client' && (
            <MenuItem
              icon="📍"
              label="Mes adresses"
              onPress={() => go('SavedAddresses')}
            />
          )}

          {activeRole === 'livreur' && (
            <>
              <MenuItem
                icon="🛵"
                label="Mes véhicules"
                onPress={() => go('DriverVehicles')}
              />
              <MenuItem
                icon="📄"
                label="Mes documents"
                onPress={() => go('DriverDocuments')}
              />
              <MenuItem
                icon="💰"
                label="Compte de versement (caution)"
                onPress={() => go('DriverMobileMoney')}
              />
              <MenuItem icon="💳" label="Mon solde" onPress={() => go('Solde')} />
              <MenuItem
                icon="🔒"
                label="Ma caution"
                onPress={() => go('Caution')}
              />
            </>
          )}

          <View style={styles.spacer} />
          <View style={styles.divider} />
          <MenuItem
            icon="🚪"
            label="Déconnexion"
            danger
            onPress={() => {
              onClose();
              void logout();
            }}
          />
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <Text style={styles.itemIcon}>{icon}</Text>
      <Text style={[styles.itemLabel, danger && styles.itemDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    backgroundColor: colors.white,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  name: { fontSize: 16, fontWeight: '700', color: colors.navy },
  role: { fontSize: 13, color: colors.orange, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.grayLight },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  itemIcon: { fontSize: 18, width: 22, textAlign: 'center' },
  itemLabel: { fontSize: 15, color: colors.navy, fontWeight: '500' },
  itemDanger: { color: colors.danger },
  spacer: { flex: 1 },
});
