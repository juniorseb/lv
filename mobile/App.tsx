import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import { applyManropeGlobally } from './src/theme/applyFonts';
import { colors } from './src/theme/colors';

// Applique Manrope à tout le texte de l'app (mapping poids → variante).
applyManropeGlobally();

// Point d'entrée de l'application Livrechap.
// Providers globaux : React Query (cache serveur) + SafeArea, puis l'aiguillage
// racine qui choisit le parcours connecté / non connecté. On charge d'abord la
// police de marque Manrope (Design System §4).
const queryClient = new QueryClient();

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        {fontsLoaded ? (
          <RootNavigator />
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.white }} />
        )}
        <StatusBar style="dark" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
