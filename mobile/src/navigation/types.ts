// Listes de paramètres de navigation (typage React Navigation).

export type AuthStackParamList = {
  Phone: undefined;
  // Le numéro normalisé (E.164) est transmis à l'écran de saisie du code.
  Otp: { phoneNumber: string };
};

// Parcours affiché quand aucun rôle actif n'est encore choisi
// (spec-app-navigation-roles §2).
export type OnboardingStackParamList = {
  RoleChoice: undefined;
  DriverOnboarding: undefined;
};

// Parcours de l'app une fois le rôle actif défini. L'écran initial dépend du
// rôle (ClientHome ou Livreur), le menu hamburger permet de tout atteindre.
export type AppStackParamList = {
  ClientHome: undefined;
  Livreur: undefined;
  // `repostFrom` : republication d'une course expirée — le formulaire est
  // pré-rempli avec l'ancienne, le client peut ajuster (prix, infos) avant de
  // republier. Une NOUVELLE livraison est créée, l'expirée reste dans l'historique.
  CreateDelivery: { repostFrom?: string } | undefined;
  DeliverySearch: { deliveryId: string };
  ActiveDelivery: { deliveryId: string };
  Conversation: { deliveryId: string };
  CreateTour: undefined;
  TourDetail: { requestId: string };
  TourList: undefined;
  TourMission: undefined;
  Recharge: undefined;
  Verification: undefined;
  ClientHistory: undefined;
  DriverHistory: undefined;
  SavedAddresses: undefined;
  DriverOnboarding: undefined;
  DriverDocuments: undefined;
  DriverVehicles: undefined;
  DriverVehicle: { mode?: 'add' } | undefined;
  DriverMobileMoney: undefined;
  DriverPublic: { driverId: string };
  Solde: undefined;
  Caution: undefined;
};
