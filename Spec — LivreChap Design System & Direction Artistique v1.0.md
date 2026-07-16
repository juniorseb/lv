Voici la spec de référence. Elle vient **après la spec psychologie UX** et devient le guide pour transformer LivreChap en un produit visuellement cohérent, reconnaissable et premium.

```markdown id="78431"
# Spec — LivreChap Design System & Direction Artistique v1.0

## Objectif

Créer une identité visuelle forte et cohérente pour LivreChap.

L'application doit transmettre instantanément :

- simplicité ;
- confiance ;
- mouvement ;
- proximité humaine ;
- professionnalisme.

L'objectif n'est pas seulement de créer une interface esthétique.

L'objectif est que l'utilisateur ressente :

> "Cette application est simple, fiable et je peux lui confier mes livraisons."

---

# 1. ADN visuel de LivreChap

## Positionnement émotionnel

LivreChap est :

- simple comme un outil du quotidien ;
- fiable comme un service financier ;
- fluide comme une application de mobilité ;
- humain comme un service de proximité.

Références émotionnelles :

- simplicité : Wave
- mobilité : Uber/Yango
- confiance : Airbnb
- clarté : Apple

LivreChap ne copie aucune identité.

Il crée son propre langage.

---

# 2. Principes visuels fondamentaux

## 2.1 Simplicité radicale

L'écran doit respirer.

Priorité :

- espace blanc ;
- hiérarchie claire ;
- peu d'éléments visibles ;
- une action dominante.

Éviter :

- surcharge ;
- multiples couleurs ;
- informations secondaires trop visibles.

---

## 2.2 Confiance avant décoration

Chaque élément visuel doit renforcer :

"Je peux faire confiance."

Favoriser :

- cartes propres ;
- informations vérifiables ;
- profils humains ;
- statuts clairs.

---

## 2.3 Mouvement

LivreChap est une plateforme de déplacement.

Le design doit suggérer :

- progression ;
- chemin ;
- connexion ;
- rapidité.

Utiliser :

- lignes de progression ;
- animations courtes ;
- transitions naturelles.

---

# 3. Identité couleur

## Couleur principale : Orange LivreChap

Rôle :

- action principale ;
- bouton CTA ;
- éléments actifs ;
- appels à l'action.

Utilisation :

Boutons :

[ Trouver un livreur ]

[ Accepter la mission ]

[ Confirmer ]

---

## Bleu nuit

Rôle :

- confiance ;
- informations importantes ;
- éléments professionnels.

Utilisation :

- header ;
- éléments livreur ;
- sections importantes.

---

## Blanc

Rôle :

- simplicité ;
- respiration ;
- clarté.

---

## Gris neutres

Rôle :

- textes secondaires ;
- séparateurs ;
- états inactifs.

---

## Vert

Utilisation uniquement :

- succès ;
- livraison terminée ;
- validation.

Exemples :

✓ Livré

✓ Vérifié

---

## Rouge

Uniquement :

- erreur ;
- problème ;
- action dangereuse.

---

# 4. Typographie

## Objectif

Lecture instantanée.

La hiérarchie doit guider l'œil.

---

## Titres

Exemples :

"Votre colis arrive"

"Mission disponible"

Caractéristiques :

- grande taille ;
- poids élevé ;
- peu de mots.

---

## Informations principales

Exemples :

1 500 FCFA

8 minutes

10 colis

Doivent être visibles immédiatement.

---

## Informations secondaires

Exemples :

Cocody → Marcory

Aujourd'hui 14h

Plus petites.

---

## Police recommandée

Police principale :

Manrope

Alternative :

Inter

Principes :

- moderne ;
- lisible ;
- accessible.

---

# 5. Système de composants

## Boutons

Un bouton principal par écran.

### Bouton primaire

Orange

Utilisation :

Actions importantes.

Exemple :

[ Trouver un livreur ]

---

### Bouton secondaire

Contour ou fond neutre.

Utilisation :

Actions alternatives.

Exemple :

[ Modifier ]

---

### Bouton danger

Rouge.

Exemple :

[ Annuler la livraison ]

---

# 6. Cartes

Les cartes sont le composant central.

Utilisation :

- livreurs ;
- missions ;
- livraisons ;
- historique.

Style :

- coins arrondis ;
- ombre légère ;
- beaucoup d'espace.

Structure :

```

Titre

Information principale

Informations secondaires

Action

```

---

Exemple :

```

Jean

⭐ 4.9
342 livraisons

Moto

[Voir profil]

```

---

# 7. Bordures et ombres

Style :

Léger.

Objectif :

Créer une profondeur naturelle.

Éviter :

- ombres fortes ;
- effets 3D ;
- interfaces lourdes.

---

# 8. Icônes

Principes :

- simples ;
- universelles ;
- cohérentes.

Utiliser :

- colis ;
- localisation ;
- téléphone ;
- véhicule ;
- portefeuille.

Éviter :

- icônes décoratives inutiles.

---

# 9. Animation et micro-interactions

Les animations doivent servir une émotion.

Jamais uniquement pour décorer.

---

## Publication livraison

Animation :

Colis → recherche → confirmation.

Emotion :

"Ma demande avance."

---

## Recherche livreur

Animation :

cercle progressif autour de la position.

Emotion :

"Le système travaille pour moi."

---

## Livreurs disponibles

Apparition progressive des cartes.

Emotion :

"J'ai des options."

---

## Livraison terminée

Animation légère de succès.

Emotion :

"Satisfaction."

---

# 10. Transitions

Durée recommandée :

200-300 ms.

Principes :

- fluides ;
- naturelles ;
- jamais bloquantes.

Transitions :

Accueil → création livraison

Carte → détail

Feed → mission

---

# 11. Design des cartes Mapbox

La carte doit appartenir à LivreChap.

Principes :

- couleurs sobres ;
- routes lisibles ;
- marqueurs orange ;
- zones importantes visibles.

Le fond ne doit jamais voler l'attention.

L'information principale reste :

le trajet.

---

# 12. Photos et profils humains

La confiance passe par les personnes.

Toujours favoriser :

- prénom ;
- photo ;
- note ;
- historique.

Exemple :

Jean

⭐ 4.9

Livreur vérifié

---

# 13. États visuels obligatoires

Chaque écran doit avoir :

## Loading

Informer.

Exemple :

"Recherche d'un livreur..."

---

## Empty state

Guider.

Exemple :

"Vous n'avez encore aucune livraison."

---

## Error state

Résoudre.

Exemple :

"Impossible de trouver votre position."

[Réessayer]

---

## Success state

Récompenser.

Exemple :

"Votre colis est livré."

---

# 14. Illustration

Utilisation limitée.

Objectif :

Créer une émotion.

Situations :

- première ouverture ;
- aucun historique ;
- validation livreur ;
- succès.

Style :

- moderne ;
- chaleureux ;
- professionnel.

Éviter :

- style enfantin ;
- trop cartoon.

---

# 15. Navigation

## Menu hamburger

Doit rester simple.

Client :

```

Profil

Mes livraisons

Mes adresses

Notifications

Aide

Paramètres

```

---

Livreur :

```

Profil

Mes missions

Mon solde

Ma caution

Mes véhicules

Documents

Paramètres

```

---

# 16. Responsive et accessibilité

Obligatoire :

- petits écrans ;
- luminosité extérieure ;
- utilisation à une main.

Principes :

- boutons larges ;
- textes lisibles ;
- contrastes suffisants.

---

# 17. Règle de cohérence

Avant chaque nouveau composant :

Question :

"Est-ce que cet élément ressemble naturellement à LivreChap ?"

Si non :

il ne doit pas être ajouté.

---

# 18. Checklist finale avant validation d'un écran

Un écran LivreChap doit respecter :

✅ Une action principale claire

✅ Compréhension en moins de 3 secondes

✅ Hiérarchie visuelle évidente

✅ Couleurs cohérentes

✅ Langage humain

✅ Animation utile uniquement

✅ Confiance renforcée

✅ Aucun élément inutile

---

# Vision finale

LivreChap doit donner cette impression :

"Je clique, je comprends, je suis rassuré."

La technologie derrière est complexe.

L'expérience devant doit sembler évidente.
```

Cette spec devient la **couche artistique officielle** au-dessus de l'architecture et de la psychologie UX. Elle permet ensuite à un designer, un développeur ou une IA de produire des écrans cohérents sans repartir de zéro à chaque fonctionnalité.
