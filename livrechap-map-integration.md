# Intégration du style Livrechap dans Mapbox

## 1. Publier le style

1. Dans **Mapbox Studio** → "Nouveau style" → "Importer un style" → coller le contenu de `livrechap-map-style.json`.
2. Ajuster si besoin les polices (`Open Sans Regular/Semibold/Bold` sont dispo par défaut chez Mapbox ; si tu veux du Manrope, il faut l'uploader dans Studio sous "Polices" — Mapbox supporte l'ajout de polices custom).
3. Publier → tu obtiens une URL du type :
   `mapbox://styles/<ton-compte>/<style-id>`
4. Utilise cette URL comme `styleURL` dans ton app (React Native Mapbox SDK) au lieu du style par défaut.

## 2. Marqueurs et itinéraire — couleurs de marque

```jsx
// Constantes de marque
const COLORS = {
  livreur: '#F97316',
  itineraire: '#F97316',
  client: '#14213D',
  pointRetrait: '#14213D',
};

// Marqueur livreur (avec halo)
<MapboxGL.PointAnnotation id="livreur" coordinate={livreurCoords}>
  <View style={styles.livreurHalo}>
    <View style={styles.livreurDot} />
  </View>
</MapboxGL.PointAnnotation>

// styles
livreurHalo: {
  width: 40, height: 40, borderRadius: 20,
  backgroundColor: 'rgba(249,115,22,0.2)', // halo orange transparent
  justifyContent: 'center', alignItems: 'center',
},
livreurDot: {
  width: 16, height: 16, borderRadius: 8,
  backgroundColor: COLORS.livreur,
  borderWidth: 2, borderColor: '#FFFFFF',
},
```

## 3. Ligne d'itinéraire (tracé progressif)

```jsx
<MapboxGL.ShapeSource id="routeSource" shape={routeGeoJSON}>
  <MapboxGL.LineLayer
    id="routeLine"
    style={{
      lineColor: COLORS.itineraire,
      lineWidth: 4,
      lineCap: 'round',
      lineJoin: 'round',
    }}
  />
</MapboxGL.ShapeSource>
```

Pour l'effet "se dessine progressivement" : découper le `routeGeoJSON` en segments et les révéler avec une `Animated.Value` interpolée sur la longueur du tracé (technique classique : `line-dasharray` animé ou révélation progressive des coordonnées du `LineString`).

## 4. Animation fluide du livreur (60fps)

Ne pas re-render le marqueur à chaque update GPS brute (souvent 1-2Hz) : interpoler la position entre deux points reçus avec `Animated.timing` sur ~1000-1500ms pour lisser le mouvement à l'écran, plutôt que de "sauter" d'un point à l'autre.

## 5. Prochaine étape suggérée

Tester ce style sur un vrai device avec des données de trajet réelles à Abidjan (Cocody → Marcory par ex.) pour valider la lisibilité des labels de quartier vs celle des rues à différents niveaux de zoom.
