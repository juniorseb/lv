const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Certains paquets (ex: zustand) exposent, via le champ "exports", un build ESM
// qui utilise `import.meta.env` — non supporté tel quel dans le bundle web
// classique de Metro (« Cannot use 'import.meta' outside a module »).
// En retirant la condition "import" de la résolution, Metro sélectionne les
// builds CJS/natifs équivalents (qui utilisent process.env.NODE_ENV), sans
// `import.meta`. Fonctionne pour le web comme pour le natif.
config.resolver.unstable_conditionNames = ['require', 'react-native', 'browser'];

module.exports = config;
