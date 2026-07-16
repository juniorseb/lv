import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ClientHomeScreen from '../screens/ClientHomeScreen';
import ConversationScreen from '../screens/ConversationScreen';
import DriverPublicScreen from '../screens/DriverPublicScreen';
import SavedAddressesScreen from '../screens/SavedAddressesScreen';
import VerificationScreen from '../screens/VerificationScreen';
import CreateDeliveryScreen from '../screens/expediteur/CreateDeliveryScreen';
import CreateTourScreen from '../screens/expediteur/CreateTourScreen';
import DeliverySearchScreen from '../screens/expediteur/DeliverySearchScreen';
import TourDetailScreen from '../screens/expediteur/TourDetailScreen';
import TourListScreen from '../screens/expediteur/TourListScreen';
import ClientHistoryScreen from '../screens/history/ClientHistoryScreen';
import DriverHistoryScreen from '../screens/history/DriverHistoryScreen';
import ActiveDeliveryScreen from '../screens/livreur/ActiveDeliveryScreen';
import CautionScreen from '../screens/livreur/CautionScreen';
import TourMissionScreen from '../screens/livreur/TourMissionScreen';
import DriverDocumentsScreen from '../screens/livreur/DriverDocumentsScreen';
import DriverOnboardingScreen from '../screens/livreur/DriverOnboardingScreen';
import LivreurScreen from '../screens/livreur/LivreurScreen';
import MobileMoneyScreen from '../screens/livreur/MobileMoneyScreen';
import RechargeScreen from '../screens/livreur/RechargeScreen';
import SoldeScreen from '../screens/livreur/SoldeScreen';
import VehicleScreen from '../screens/livreur/VehicleScreen';
import VehiclesListScreen from '../screens/livreur/VehiclesListScreen';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

// Parcours de l'app une fois le rôle actif défini. L'écran initial dépend du
// rôle (le livreur arrive direct sur son tableau, le client sur l'accueil
// expéditeur) — plus de re-choix au démarrage (spec-app-navigation-roles §2).
export default function AppNavigator() {
  const activeRole = useAuthStore((s) => s.user?.activeRole);
  const initialRouteName = activeRole === 'livreur' ? 'Livreur' : 'ClientHome';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerTintColor: colors.navy,
        headerStyle: { backgroundColor: colors.white },
        contentStyle: { backgroundColor: colors.white },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="ClientHome"
        component={ClientHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Livreur"
        component={LivreurScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateDelivery"
        component={CreateDeliveryScreen}
        options={{ title: 'Envoyer un colis' }}
      />
      <Stack.Screen
        name="DeliverySearch"
        component={DeliverySearchScreen}
        options={{ title: 'Votre livraison', headerBackVisible: false }}
      />
      <Stack.Screen
        name="ActiveDelivery"
        component={ActiveDeliveryScreen}
        options={{ title: 'Course en cours', headerBackVisible: false }}
      />
      <Stack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={{ title: 'Messages' }}
      />
      <Stack.Screen
        name="CreateTour"
        component={CreateTourScreen}
        options={{ title: 'Nouvelle tournée' }}
      />
      <Stack.Screen
        name="TourDetail"
        component={TourDetailScreen}
        options={{ title: 'Ma tournée' }}
      />
      <Stack.Screen
        name="TourList"
        component={TourListScreen}
        options={{ title: 'Mes tournées' }}
      />
      <Stack.Screen
        name="TourMission"
        component={TourMissionScreen}
        options={{ title: 'Tournée en cours', headerBackVisible: false }}
      />
      <Stack.Screen
        name="Recharge"
        component={RechargeScreen}
        options={{ title: 'Recharger la caution' }}
      />
      <Stack.Screen
        name="Solde"
        component={SoldeScreen}
        options={{ title: 'Mon solde' }}
      />
      <Stack.Screen
        name="Caution"
        component={CautionScreen}
        options={{ title: 'Ma caution' }}
      />
      <Stack.Screen
        name="Verification"
        component={VerificationScreen}
        options={{ title: 'Profil & vérification' }}
      />
      <Stack.Screen
        name="ClientHistory"
        component={ClientHistoryScreen}
        options={{ title: 'Mes expéditions' }}
      />
      <Stack.Screen
        name="DriverHistory"
        component={DriverHistoryScreen}
        options={{ title: 'Mes livraisons' }}
      />
      <Stack.Screen
        name="SavedAddresses"
        component={SavedAddressesScreen}
        options={{ title: 'Mes adresses' }}
      />
      <Stack.Screen
        name="DriverOnboarding"
        component={DriverOnboardingScreen}
        options={{ title: 'Devenir livreur' }}
      />
      <Stack.Screen
        name="DriverDocuments"
        component={DriverDocumentsScreen}
        options={{ title: 'Mes documents' }}
      />
      <Stack.Screen
        name="DriverVehicles"
        component={VehiclesListScreen}
        options={{ title: 'Mes véhicules' }}
      />
      <Stack.Screen
        name="DriverVehicle"
        component={VehicleScreen}
        options={{ title: 'Mon véhicule' }}
      />
      <Stack.Screen
        name="DriverPublic"
        component={DriverPublicScreen}
        options={{ title: 'Profil du livreur' }}
      />
      <Stack.Screen
        name="DriverMobileMoney"
        component={MobileMoneyScreen}
        options={{ title: 'Compte de versement (caution)' }}
      />
    </Stack.Navigator>
  );
}
