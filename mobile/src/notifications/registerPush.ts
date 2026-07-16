import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { notificationsApi } from '../api/notifications';

// Enregistre l'appareil pour les notifications push (dossier §10, FCM).
// Best-effort : demande la permission, récupère le jeton natif de l'appareil et
// le transmet au backend. Toute erreur est silencieuse (l'app fonctionne sans).
//
// Note : en production, aligner le type de jeton (natif FCM/APNs via
// getDevicePushTokenAsync, utilisé ici) avec l'émetteur backend (firebase-admin).
export async function registerForPushNotifications(): Promise<void> {
  try {
    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted) {
      const request = await Notifications.requestPermissionsAsync();
      granted = request.granted;
    }
    if (!granted) {
      return;
    }

    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    const token = tokenResponse.data;
    if (typeof token !== 'string' || token.length === 0) {
      return;
    }

    const platform: 'android' | 'ios' | 'web' =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    await notificationsApi.registerDevice(token, platform);
  } catch {
    // Push indisponible (Expo Go, permissions, config manquante) : on ignore.
  }
}
