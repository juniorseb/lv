import { registerRootComponent } from 'expo';

import App from './App';

// Point d'entrée : enregistre le composant racine (équivalent de
// AppRegistry.registerComponent), compatible Expo Go et build natif.
registerRootComponent(App);
