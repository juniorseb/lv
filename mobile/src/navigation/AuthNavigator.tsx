import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import OtpScreen from '../screens/auth/OtpScreen';
import PhoneScreen from '../screens/auth/PhoneScreen';
import { colors } from '../theme/colors';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

// Parcours non connecté : saisie du numéro puis du code OTP.
export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen
        name="Otp"
        component={OtpScreen}
        options={{ headerShown: true, title: '', headerBackTitle: 'Retour' }}
      />
    </Stack.Navigator>
  );
}
