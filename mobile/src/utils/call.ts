import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';

// Appel direct via le composeur natif (spec-communication §4 : pas de VoIP, vrai
// numéro). Confirmation affichée UNIQUEMENT avant le premier appel (§5), puis
// plus jamais.
const CONFIRMED_KEY = 'lc_call_confirmed';

export async function callNumber(
  phone: string,
  displayName: string,
): Promise<void> {
  const dial = () => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  const confirmed = await AsyncStorage.getItem(CONFIRMED_KEY);
  if (confirmed) {
    void dial();
    return;
  }
  Alert.alert(
    `Appeler ${displayName} ?`,
    'Vous allez utiliser votre réseau téléphonique.',
    [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Appeler',
        onPress: () => {
          void AsyncStorage.setItem(CONFIRMED_KEY, '1');
          void dial();
        },
      },
    ],
  );
}
