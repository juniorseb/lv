# Spec technique — Sélecteur d'adresse carte Livrechap (UX type Yango/Uber) — v3

## Contexte technique
App Livrechap : React Native/Expo, Mapbox GL/SDK, backend NestJS. Écran de sélection d'adresse (expéditeur ou destinataire).

## Vision produit
- Le pin reste fixe au centre de l'écran ; c'est la carte qui bouge en dessous.
- L'adresse correspondant au centre de la carte s'affiche automatiquement.
- Retour à la position GPS actuelle en un tap.
- Impossible de valider une adresse sans savoir précisément ce qui est sélectionné.
- Contexte ivoirien : quartier et repères humains souvent plus parlants que le nom de rue exact.
- Objectif : sélection d'une adresse en moins de 10 secondes.

> Note de positionnement : bandeau d'adresse placé en bas (zone d'atteinte pouce, cohérent Uber/Bolt). Inversion possible sans impact sur le reste de la spec si Yango place ce bandeau en haut.

---

## 1. Structure de l'écran

```
--------------------------------
| 🔍 Recherche d'adresse        |
--------------------------------
|                              |
|          📍                  |   ← pin fixe, ne bouge JAMAIS
|                              |
|                         ◎    |   ← bouton "Ma position"
--------------------------------
| Rue F146                     |
| Angré 8e Tranche, Cocody     |
| Précision pour le livreur :  |
| [ Ajouter un repère ]        |
|                              |
| [ Confirmer cette adresse ]  |
--------------------------------
```

---

## 2. Pin fixe et déplacement de carte

- Le pin n'est jamais un marker déplaçable — fixe visuellement au centre, overlay indépendant de la carte.
- C'est la caméra/carte qui se déplace en dessous.
- ❌ À éviter : pin posé/déplacé au tap.
- ✅ Cible : carte qui glisse sous un pin fixe.
- Animation (P2) : léger soulèvement du pin pendant le mouvement, redescente à l'arrêt.

---

## 3. Ouverture de l'écran — position immédiate + précision progressive

Pour éviter un écran vide pendant les 2-5 secondes que peut prendre un GPS précis :

```
Ouverture de l'écran :
1. Utiliser immédiatement la dernière position connue (cache device / dernière session)
2. Charger le GPS précis en arrière-plan
3. Mettre à jour la caméra en douceur dès que le GPS précis est disponible
```

L'utilisateur voit une carte tout de suite, jamais un écran de chargement vide.

---

## 4. Bouton "Ma position actuelle"

### UI
- Bouton flottant circulaire, bas droite de la carte.
- Ne jamais recouvrir l'attribution Mapbox obligatoire (logo + texte d'attribution) — respecter sa zone réservée telle que définie par le SDK utilisé, sans imposer de position fixe qui pourrait entrer en conflit si l'emplacement de l'attribution change selon la version du SDK.
- Style : cercle blanc, ombre légère, icône localisation/crosshair, taille tap confortable (48-56px minimum).

### Comportement
```
Tap
 ↓
Vérifier permission GPS
 ↓
Si accordée : getCurrentPosition()
 ↓
camera.animateTo({ latitude, longitude, zoom: 16 })
 ↓
attendre fin de l'animation
 ↓
déclencher reverse geocoding (section 6)
 ↓
mise à jour du bandeau d'adresse
```
- Afficher un indicateur de position GPS réelle (point bleu avec halo), distinct du pin central de sélection.

### États du bouton
- **Normal** : icône neutre.
- **Chargement** : spinner pendant la récupération GPS.
- **Permission refusée** : message explicite — "Votre localisation est désactivée. Activez-la dans les paramètres pour utiliser cette fonction." Jamais d'échec silencieux.
- **Désactivé** pendant une animation de caméra déjà en cours.

---

## 5. Gestion de la précision GPS faible

Contexte Abidjan : utilisateurs en intérieur, zones à signal faible.

```
Si précision GPS rapportée > 50 mètres :
  Afficher un bandeau discret :
  "Position approximative, déplacez la carte pour ajuster"
```

Ne bloque rien, informe seulement l'utilisateur que la position affichée peut être imprécise.

---

## 6. Reverse geocoding automatique

### Déclenchement
- Événement `onCameraIdle` (ou équivalent SDK).
- Debounce 400-600ms après l'arrêt du mouvement.
- Jamais d'appel API pendant un déplacement continu.

### Annulation des requêtes en vol
- Si l'utilisateur redéplace la carte avant qu'une requête précédente n'ait répondu, **annuler explicitement** cette requête pour éviter qu'une réponse obsolète n'écrase un résultat plus récent.

### Cache local
- Clé de cache : `round(latitude, 4)`, `round(longitude, 4)` — précision d'environ 10-15 mètres selon la latitude (plus adapté à une livraison qu'un arrondi à 100m).

### API et fallback — logique côté backend, pas côté client
```
Mapbox Reverse Geocoding
        |
 Si aucun résultat
        |
Service backend Livrechap
        |
OSM/Nominatim ou autre fournisseur
```
Le fallback vers OSM/Nominatim **ne doit jamais être un appel direct depuis l'application mobile** : l'instance publique de Nominatim n'est pas dimensionnée pour un trafic commercial soutenu (risque de blocage, pas d'engagement de disponibilité). Le backend Livrechap doit posséder ce fallback, avec sa propre gestion de rate-limiting/cache serveur, et potentiellement sa propre instance Nominatim self-hosted si le volume le justifie plus tard.

---

## 7. Bandeau d'adresse (bas de l'écran)

- Toujours visible.
- **Pendant la recherche** : "Recherche de l'adresse..." + loader/skeleton.
- **Après résultat**, structure :
  - Ligne principale (gras) : rue ou lieu le plus pertinent.
  - Ligne secondaire : quartier + commune.
  - **Champ "Précision pour le livreur"** : lien/bouton "Ajouter un repère" sous l'adresse — champ texte libre optionnel (voir ticket séparé `ticket-precision-livreur.md` pour la logique complète côté commande/livreur ; ici, seule l'entrée initiale au niveau de la carte est concernée).
- **Priorité d'affichage** : Rue → Quartier → Commune → Ville.
- **Si aucun résultat précis** : jamais de bandeau vide — fallback explicite (coordonnées GPS brutes, ou repère proche si disponible).

---

## 8. Bouton "Confirmer cette adresse"

- Désactivé tant que le reverse geocoding est en cours ou non abouti.
- Activé dès qu'une adresse (ou fallback coordonnées) est disponible.
- Retour structuré :

```json
{
  "latitude": 5.359,
  "longitude": -3.986,
  "formattedAddress": "Rue F146, Angré 8e Tranche, Cocody, Abidjan",
  "neighborhood": "Angré 8e Tranche",
  "city": "Abidjan",
  "landmark": "Près de la pharmacie X"
}
```

---

## 9. Recherche manuelle d'adresse — architecture en abstraction de fournisseur

Ne pas coupler directement l'UI à un seul fournisseur de recherche. Prévoir une couche d'abstraction dès maintenant, même si un seul fournisseur est branché au départ :

```
AddressSearchService
     |
     |---- Mapbox Search Box API (actif au lancement)
     |
     |---- Yandex Search (option future, si les tests de précision le justifient)
     |
     |---- Base locale Livrechap (objectif long terme)
```

Raison stratégique : l'avantage durable de Livrechap sera probablement sa propre base d'adresses enrichie par l'usage réel (cf. discussion précédente sur la construction progressive d'une base locale via les livraisons confirmées) :

```
"Rue F146, 82"
        ↓
Livrechap Address Database
        ↓
Position exacte + repère
```

Cette abstraction permet de brancher/débrancher un fournisseur ou de prioriser la base locale dès qu'elle devient suffisamment riche, sans réécrire l'écran de sélection d'adresse.

### Comportement de recherche
- Recherche sur : rue, quartier, commune, commerce, point connu.
- Après sélection d'un résultat : déplacer la caméra (même animation que "Ma position"), pin reste fixe, reverse geocoding relancé sur cette position pour cohérence avec ce qui sera réellement enregistré.

---

## 10. Priorisation d'implémentation

**P0 — obligatoire pour ce sprint :**
- Pin fixe au centre
- Reverse geocoding automatique avec debounce + annulation des requêtes obsolètes
- Bouton "Ma position" avec gestion des permissions
- Dernière position connue au démarrage, puis GPS précis en arrière-plan
- Affichage de l'adresse avec fallback si vide
- Bouton "Confirmer" désactivé/activé selon l'état

**P1 — dès que possible après le P0 :**
- Cache local des résultats de geocoding (précision 10-15m)
- Barre de recherche manuelle, via `AddressSearchService` abstrait
- Fallback OSM/Nominatim géré côté backend
- Champ "Précision pour le livreur" côté saisie carte (logique complète dans le ticket séparé)
- Bandeau "position approximative" si précision GPS faible

**P2 — amélioration, non bloquant :**
- Animation de soulèvement/redescente du pin
- Suggestions intelligentes d'adresses (historique, favoris)
- Intégration Yandex Search comme fournisseur alternatif dans `AddressSearchService`

---

## 11. Critères de validation (definition of done)

- ✅ Ouverture de l'écran → dernière position connue visible immédiatement, GPS précis chargé en arrière-plan
- ✅ Adresse affichée automatiquement dès l'arrêt du mouvement de carte
- ✅ Pin toujours fixe au centre, jamais déplacé manuellement
- ✅ Bouton "Ma position" fonctionne, y compris cas de permission refusée
- ✅ Bandeau "position approximative" affiché si précision GPS > 50m
- ✅ Aucun bandeau d'adresse vide : toujours un résultat ou un fallback explicite
- ✅ Champ "Précision pour le livreur" accessible depuis le bandeau
- ✅ Bouton "Confirmer" jamais actif avant résolution de l'adresse
- ✅ Aucun appel API excessif pendant un déplacement continu (debounce + cancellation respectés)
- ✅ Fallback OSM/Nominatim géré côté backend, jamais appelé directement depuis l'app mobile
- ✅ Recherche manuelle passe par une abstraction `AddressSearchService`, pas un appel direct câblé en dur
- ✅ Expérience globale perçue comme proche de Yango/Uber/Bolt

## Fichiers probablement concernés
- Écran de sélection d'adresse (`AddressPickerScreen` ou équivalent)
- Composant carte partagé (`MapView`/`LivrechapMap`)
- `AddressSearchService` (nouvelle abstraction à créer si inexistante)
- Service de geocoding client existant (étendre plutôt que dupliquer)
- Endpoint backend NestJS pour le fallback OSM/Nominatim (nouveau, si pas déjà présent)

## Document lié
- `ticket-precision-livreur.md` — logique complète du champ "Précision pour le livreur" côté formulaire de commande et écran livreur (ce document-ci ne couvre que le point d'entrée du champ au niveau du sélecteur de carte).
