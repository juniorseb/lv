import * as ImagePicker from 'expo-image-picker';

// Sélection d'une image depuis la galerie. Renvoie l'URI locale ou null si
// l'utilisateur annule ou refuse l'accès.
export async function pickImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.6,
    allowsEditing: true,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  return result.assets[0].uri;
}

// Capture d'une photo par la caméra (selfie « live », photos de documents pris
// sur le vif — spec-onboarding-livreur-v2 §1 étape 4). `front` ouvre la caméra
// frontale pour le selfie. Renvoie l'URI locale ou null si annulé/refusé.
export async function captureImage(
  options: { front?: boolean } = {},
): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    cameraType: options.front
      ? ImagePicker.CameraType.front
      : ImagePicker.CameraType.back,
    quality: 0.6,
    allowsEditing: true,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  return result.assets[0].uri;
}
