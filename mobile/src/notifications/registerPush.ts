import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { notificationsApi } from '../api/notifications';

// Enregistre l'appareil pour les notifications push (dossier §10).
//
// On demande un jeton EXPO, et non le jeton natif (getDevicePushTokenAsync) : le
// backend envoie via le service Expo, qui relaie vers FCM et APNs. Le jeton natif
// d'iOS est un jeton APNs brut, qu'un envoi FCM ne sait pas adresser — c'est ce
// qui rendait l'approche précédente silencieusement cassée sur iOS.
//
// Best-effort : toute erreur est silencieuse, l'app fonctionne sans push.

// getExpoPushTokenAsync exige l'identifiant de projet EAS, injecté dans app.json
// par `eas init` (extra.eas.projectId).
function getProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

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

    const projectId = getProjectId();
    if (!projectId) {
      // Sans projectId, aucun jeton ne peut être émis. On le DIT une fois plutôt
      // que d'échouer en silence : c'est la cause n°1 d'un « les push ne
      // marchent pas » qu'on cherche pendant des heures.
      console.warn(
        '[push] Aucun projectId EAS dans app.json (extra.eas.projectId) — ' +
          'lancez `eas init`. Enregistrement ignoré.',
      );
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (typeof token !== 'string' || token.length === 0) {
      return;
    }

    const platform: 'android' | 'ios' | 'web' =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    await notificationsApi.registerDevice(token, platform);
  } catch {
    // Push indisponible (Expo Go sans compte, permissions, config manquante).
  }
}
