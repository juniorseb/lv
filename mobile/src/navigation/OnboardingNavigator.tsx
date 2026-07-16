import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RoleChoiceScreen from '../screens/RoleChoiceScreen';
import DriverOnboardingScreen from '../screens/livreur/DriverOnboardingScreen';
import { colors } from '../theme/colors';
import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

// Affiché uniquement quand aucun rôle actif n'est encore choisi. Dès qu'un rôle
// est défini (via « Je veux… » ou l'onboarding livreur), RootNavigator bascule
// automatiquement vers l'app.
export default function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.navy,
        headerStyle: { backgroundColor: colors.white },
        contentStyle: { backgroundColor: colors.white },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="RoleChoice"
        component={RoleChoiceScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverOnboarding"
        component={DriverOnboardingScreen}
        options={{ title: 'Devenir livreur' }}
      />
    </Stack.Navigator>
  );
}
