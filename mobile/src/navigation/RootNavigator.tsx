import React, { useEffect } from 'react';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { registerForPushNotifications } from '../notifications/registerPush';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import AppNavigator from './AppNavigator';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import type { AppStackParamList } from './types';

// Liens de suivi envoyés par SMS au destinataire qui a un compte
// (`livrechap://delivery/<id>`). Ouvre directement le suivi de la course.
// Si l'utilisateur n'est pas connecté, le lien est mémorisé par React Navigation
// et rejoué après l'authentification.
const linking: LinkingOptions<AppStackParamList> = {
  prefixes: [Linking.createURL('/'), 'livrechap://'],
  config: {
    screens: {
      DeliverySearch: 'delivery/:deliveryId',
    },
  },
};

// Aiguillage racine : affiche le parcours connecté ou non selon l'état d'auth,
// restauré au démarrage depuis le stockage sécurisé.
export default function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const activeRole = useAuthStore((s) => s.user?.activeRole ?? null);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Une fois connecté, enregistre l'appareil pour les notifications push.
  useEffect(() => {
    if (status === 'authenticated') {
      void registerForPushNotifications();
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {status !== 'authenticated' ? (
        <AuthNavigator />
      ) : activeRole ? (
        <AppNavigator />
      ) : (
        // Connecté mais aucun rôle actif choisi → écran « Je veux… ».
        <OnboardingNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
