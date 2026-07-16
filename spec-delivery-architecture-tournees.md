# Spec — Architecture de gestion des livraisons Livrechap
## Livraison simple, groupée, tournée, et cas particuliers

> ⚠️ **Instruction pour Claude Code** : avant d'implémenter un point quelconque de ce document, vérifie d'abord ce qui existe déjà dans le codebase (modèles de données, écrans, endpoints). Plusieurs éléments ci-dessous (statuts de colis, disponibilité livreur, preuves, capacité véhicule, etc.) peuvent déjà être partiellement ou totalement couverts par du code existant. Dans ce cas : ignore ou adapte la section correspondante plutôt que de dupliquer une entité, un champ ou un écran déjà présent. Ce document décrit l'architecture cible complète, pas une liste stricte de fichiers à créer depuis zéro.

## Contexte et vision

Livrechap ne doit pas être codé autour de "une commande = un livreur". La bonne architecture est :

> **Une demande logistique peut contenir une ou plusieurs livraisons, et une livraison peut être exécutée par un ou plusieurs livreurs.**

C'est une décision d'architecture à prendre **maintenant**, dans le modèle de données, même si l'interface utilisateur ne propose au lancement que le cas le plus simple (livraison unique). Changer ce modèle après coup, une fois des données réelles en production, coûterait beaucoup plus cher qu'une bonne base dès le départ.

Vision long terme : Livrechap n'est pas seulement une marketplace "colis → livreur", mais une marketplace "besoin logistique → capacité de livraison", couvrant à terme particuliers, vendeurs en ligne, restaurants, commerces et entreprises.

---

## 1. Les types de demande logistique

### 1.1 Livraison unique (particulier)
```
Expéditeur → 1 colis → 1 destinataire → 1 livreur
```
Exemple : "Envoyer un document à Marcory." C'est le cas déjà couvert par les specs existantes (sélecteur d'adresse, onboarding, navigation).

### 1.2 Livraison groupée / tournée (vendeur en ligne)
```
Expéditeur → plusieurs colis → plusieurs destinataires → 1 livreur
```
Exemple concret : un vendeur d'AirPods sur Instagram a 10 clients dans différentes zones (Cocody, Plateau, Marcory, Yopougon). Au lieu de créer 10 demandes séparées, il crée **une tournée** :

```
Expéditeur : Junior (vendeur)
Type : Distribution de colis
Nombre de colis : 10
Point de départ : Chez Junior
Zones : Cocody, Plateau, Marcory, Yopougon
Prix proposé : 15 000 FCFA
Urgence : Aujourd'hui
```

Le livreur qui accepte voit une **mission** avec 10 arrêts, pas 10 commandes séparées.

**Avantage stratégique** : beaucoup de vendeurs Instagram/Facebook, boutiques WhatsApp et petits e-commerçants ivoiriens ont 20-50 commandes par jour sans solution logistique. C'est un vrai axe de différenciation ("Vous avez 10, 50 ou 100 colis à livrer aujourd'hui ? Trouvez un livreur pour toute votre tournée").

### 1.3 Restaurant avec plusieurs commandes
```
Restaurant → 20 repas → 20 clients → 1 ou plusieurs livreurs
```
Le système peut proposer un seul livreur pour toute la zone, ou plusieurs livreurs si les distances sont trop grandes (contrainte fraîcheur/rapidité propre à la restauration).

> **Note de cohérence avec la décision déjà actée** : pour la V1, on garde le modèle simple discuté précédemment — file d'attente marchand (statut "Prête" déclenche la recherche) + un livreur par commande, sans batching automatique. Le modèle "tournée" décrit ici pour les restaurants est une évolution **P2**, à activer uniquement quand le volume de commandes simultanées par restaurant le justifie, et seulement pour des commandes n'ayant pas la même contrainte de fraîcheur qu'un plat chaud.

### 1.4 Entreprise avec livraison récurrente
```
Entreprise → tournées récurrentes → livreurs partenaires
```
Exemple : une pharmacie ou boutique avec 50 commandes/jour, besoin de programmation automatique et de livreurs préférés/attitrés. Fonctionnalité P2, nécessite un système de contrat entreprise à définir séparément.

---

## 2. Cas particuliers à prévoir dans le modèle de données (même si non actifs en V1)

| Cas | Description | Priorité |
|---|---|---|
| Plusieurs livreurs pour une même livraison | Colis lourd/volumineux (meuble, électroménager) nécessitant assistance à deux | P2 |
| Ramassage multiple ("tournée inversée") | Un restaurant récupère des produits chez plusieurs fournisseurs avant de livrer le client final | P2 |
| Livraison urgente | Priorité Normal / Urgent / Express — impacte le prix et la vitesse de recherche de livreur | P1 |
| Livraison programmée | Date/heure choisies à l'avance (ex. "livrer demain à 10h") | P1 |
| Paiement à la réception (COD) | Le livreur collecte le prix de l'article + frais de livraison, puis reverse au vendeur — **très pertinent pour le contexte ivoirien** (vendeurs Instagram/WhatsApp) | P1 |
| Preuve de livraison | Photo du colis, signature numérique, ou code OTP envoyé au client pour confirmer la réception — évite les litiges | P1 |
| Multi-véhicules et capacité | Vélo (petits colis), Moto (repas/petits colis), Voiture (colis moyens), Fourgonnette (gros volumes) — chaque véhicule a une capacité déclarée (ex. moto = 5 petits colis, voiture = 15 colis) pour éviter d'assigner une tournée impossible | P1 (cohérent avec les types de véhicule déjà définis dans l'onboarding) |

---

## 2 bis. Ajouts issus de la revue d'architecture

### Retour colis en cas d'échec de livraison
Quand un `Stop` est marqué "Client absent / Client refuse / Mauvais numéro / Adresse introuvable" (section 7), le `Package` concerné doit pouvoir passer explicitement en statut `retour` plutôt que de rester bloqué dans un statut ambigu. Prévoir une option "Retour à l'expéditeur" avec un trajet retour dédié (peut être une simple réassignation du même livreur en fin de tournée, pas nécessairement une nouvelle mission complète).

### Preuve de collecte (symétrique à la preuve de livraison)
Au moment où le livreur récupère les colis chez l'expéditeur (vendeur, restaurant), confirmation explicite : nombre de colis récupérés, photo si pertinent, code de collecte fourni par l'expéditeur. Objectif : éviter les litiges du type "je t'ai donné 20 colis" / "non, tu m'en as donné 15" — symétrique à la preuve de livraison déjà prévue section 9, mais côté collecte.

### Disponibilité du livreur (statut temps réel)
```
DriverStatus : ONLINE / OFFLINE / BUSY / PAUSED
```
Nécessaire pour que le système sache à qui proposer une nouvelle mission — un livreur `BUSY` (déjà en tournée) ou `OFFLINE` ne doit pas recevoir de nouvelles offres. Affiché simplement côté livreur (ex. "🟢 Disponible" / "🔴 En livraison — Mission #452").

### Offre de prix négociée par le livreur
Le modèle actuel suppose que le client/expéditeur fixe le prix. Prévoir que le livreur puisse soit accepter ce prix, soit contre-proposer :
```
DeliveryOffer
  delivery_request_id, driver_id, prix_propose, statut (en_attente/accepte/refuse)
```
Permet une négociation simple sans bloquer le système sur un prix unique non négociable — pertinent notamment pour les tournées complexes (zones étendues, urgence) où le prix initial proposé par l'expéditeur peut ne pas correspondre à la réalité du terrain.

### Réservation de tournée récurrente (entreprise) — rappel P2
Cf. section 1.4. Modèle de données à prévoir dès que ce cas est activé :
```
RecurringDelivery
  entreprise_id, frequency (daily/weekly), heure_depart, livreur_prefere_id
```

### Préparation d'un futur système de collecte de paiement sécurisée (COD)
Le modèle actuel (section 8) part du principe que Livrechap ne collecte jamais l'argent des livraisons, le livreur reversant l'article en direct au vendeur. C'est la bonne décision pour le MVP — mais il y a une vraie opportunité de valeur ajoutée à terme si Livrechap sécurise ce flux :
```
Client paie → Livreur collecte → Plateforme sécurise → Vendeur reçoit
```
Sans activer cette fonctionnalité maintenant, prévoir la structure de données pour ne pas avoir à tout re-modéliser plus tard :
```
PaymentCollection
  id, package_id, montant_a_collecter, livreur_collecteur_id,
  statut (en_attente/collecte/reverse), date_reception
```
Cette table reste vide/inactive en V1 — c'est une réservation de structure, pas une fonctionnalité à construire maintenant.

### Score de difficulté de mission
Optionnel mais utile pour la rémunération, l'attribution et la confiance :
```
Difficulty Score : 1 ⭐ (facile) à 5 ⭐ (difficile)
```
Calculé à partir du nombre d'arrêts, de la distance totale, du poids des colis, du nombre de zones traversées, et de la présence ou non de COD. Permet à terme de moduler la rémunération ou de prioriser l'attribution vers des livreurs expérimentés pour les missions difficiles.

---

## 3. Modèle de données recommandé

```
DeliveryRequest (demande logistique globale)
  id, client_id, type (single / batch / route / recurring),
  point_depart, statut_global, prix_total, urgence, date_programmee

Route (une tournée = un regroupement d'arrêts assignés à un livreur)
  id, delivery_request_id, driver_id, distance_estimee, gain_total,
  commission_totale, statut (en_attente / en_cours / terminee)

Stop (un arrêt individuel dans une route)
  id, route_id, destinataire_nom, destinataire_telephone, adresse,
  landmark (repère livreur, cf. ticket-precision-livreur.md),
  prix_livraison, ordre_optimise (position dans la tournée après optimisation),
  statut (en_attente / en_route / livre / probleme),
  preuve_livraison (photo_url / signature / otp_code)

Package (colis — entité séparée du Stop)
  id, stop_id, description_produit, valeur_declaree, poids, fragile (bool),
  statut (cree / assigne / recupere / en_transport / livre / retour),
  preuve_collecte (photo_url / code_expediteur)

# Pourquoi séparer Package et Stop :
# un colis existe indépendamment de son trajet (utile pour l'assurance colis,
# le suivi, l'historique, et surtout la gestion de litiges — un Stop peut regrouper
# plusieurs colis, ex. un vendeur qui envoie 3 articles au même client en une tournée).

TrackingEvent (historique horodaté, pour litiges et audit)
  id, package_id, type_evenement, timestamp, details

vehicle_capacity (liée à `vehicles` du schéma onboarding)
  vehicle_id, capacite_poids_kg, capacite_volume_litres, capacite_max_colis
  # plus riche qu'un simple "capacite_max_colis" : 10 petits AirPods ≠ 10 gros colis
```

### Compatibilité avec le modèle "livraison simple" déjà spécifié
Une livraison unique (section 1.1, déjà couverte par `spec-address-picker-map-v3.md`) devient simplement : `DeliveryRequest` de type `single`, contenant une seule `Route` avec un seul `Stop`. Ça ne casse rien de l'existant — c'est une généralisation, pas un remplacement.

---

## 4. Écran côté livreur

### 4.1 Cas livraison simple (1 colis)
```
Mission #4521

📍 Étape 1 — Récupération colis
Départ : Restaurant Chez Paul
[Navigation vers le point de collecte]
↓
📍 Étape 2 — Livraison
Destination : Cocody Riviera
[Navigation vers le client]
↓
✅ Livraison terminée
```
Simple point A → point B, déjà cohérent avec l'existant.

### 4.2 Cas tournée (plusieurs colis)

**Avant d'accepter :**
```
🛵 Tournée disponible
Expéditeur : Junior Shop
Nombre de colis : 10
Collecte : Cocody
Zones : Cocody, Plateau, Marcory
Gain : 15 000 FCFA
Durée estimée : 3h
[Accepter]
```

**Après collecte, ordre optimisé automatiquement :**
```
Départ : Chez Junior
1️⃣ Plateau — Client 0105
2️⃣ Cocody Deux Plateaux — Client 0346
3️⃣ Cocody Faya — Client 0102
4️⃣ Marcory — Client 0501
5️⃣ Yopougon Selmer — Client 0602
```

**Pendant la tournée, un seul arrêt affiché à la fois (pas 10 cartes ouvertes) :**
```
🛵 Tournée en cours
Progression : ██████░░░░ 6/10

Prochaine livraison :
📦 Client 0346
📍 Cocody Faya
Colis : AirPods x1
Distance : 2,3 km

[Navigation] [Appeler client] [Marquer livré]
```

### 4.3 Le concept de "Mission" (remplace "commande" côté vocabulaire livreur)
```
Mes missions
🟢 Mission active — 10 colis
⚪ Missions disponibles — 3
```
Une mission peut contenir plusieurs livraisons (`Stops`), le livreur pense en missions, pas en commandes individuelles.

---

## 5. Navigation GPS — deux options

**Option A — Ouvrir Google Maps / Waze (recommandé pour le lancement)**
Bouton "Naviguer" qui ouvre l'app de navigation externe déjà installée sur le téléphone du livreur. Rapide à développer, zéro dépendance supplémentaire.

**Option B — Carte intégrée dans l'app (façon Uber)**
Utilise le stack Mapbox déjà en place (`livrechap-map-style.json`) : le livreur voit sa position, ses arrêts, l'ordre des livraisons et sa progression directement dans Livrechap. Plus lourd à développer, mais plus intégré et cohérent avec l'identité de marque.

**Recommandation** : Option A pour le MVP (P0), migration vers Option B en P2 une fois le volume de tournées actives le justifie.

---

## 6. Optimisation automatique de tournée

Le moteur d'optimisation prend en compte : position actuelle du livreur, positions des différents clients, trafic, horaires, priorité — et calcule le meilleur ordre de passage (distance/temps minimisés).

⚠️ **Complexité technique réelle à anticiper** : un vrai algorithme d'optimisation de tournée (proche du "problème du voyageur de commerce") est un chantier à part entière. Pour la V1 des tournées (P1), une heuristique simple suffit (ex. "plus proche voisin" — trier les arrêts par distance depuis le point courant, recalculer à chaque arrêt validé) plutôt qu'un vrai solveur d'optimisation, qui peut être introduit en P2/P3 si le volume de tournées le justifie.

---

## 7. Gestion des imprévus

Quand un arrêt ne peut pas être complété, le livreur signale :
```
Problème livraison
○ Client absent
○ Mauvaise adresse
○ Client injoignable
○ Refus
```
Le système passe à l'arrêt suivant, reprogramme l'arrêt problématique (retry plus tard dans la tournée si possible), et informe le client concerné.

---

## 8. Paiement à la réception (COD) — détail important pour le contexte ivoirien

Cas fréquent des vendeurs Instagram/WhatsApp : le client paie à la livraison, pas à la commande.
```
Le livreur collecte :
Prix article : 20 000 FCFA
Frais livraison : 1 500 FCFA
```
Le livreur reverse ensuite le montant de l'article au vendeur (hors plateforme, en direct — cohérent avec le modèle déjà acté où Livrechap ne collecte jamais l'argent des livraisons). Les frais de livraison, eux, suivent le modèle caution déjà défini (commission débitée de la caution du livreur à chaque livraison terminée).

**Point à surveiller** : le COD introduit un risque de confiance supplémentaire (le livreur détient temporairement l'argent de l'article, pas seulement le colis) — à considérer dans les critères de badge de confiance (`spec-onboarding-livreur-v2.md`, section 7) et potentiellement dans le calcul du seuil de caution requis pour les livreurs qui acceptent des missions COD.

---

## 9. Preuve de livraison

Pour limiter les litiges, à la livraison :
- Photo du colis livré, et/ou
- Signature numérique du destinataire, et/ou
- Code OTP envoyé au client, saisi par le livreur pour confirmer la réception

```
Code client : 4582
Livraison confirmée ✅
```

Recommandation : commencer par le code OTP en P1 (le plus simple techniquement, pas besoin de gérer l'upload/stockage de photos ou la capture de signature), ajouter photo/signature en P2 si les litiges le justifient.

---

## 10. Priorisation d'implémentation

**P0 — fondation architecture (obligatoire, même si l'UI ne montre que le cas simple) :**
- Modèle de données `DeliveryRequest` → `Route` → `Stop` → `Package` (section 3), même si seul le type `single` est actif
- Statut du colis (`Package.status`) séparé du statut de l'arrêt (`Stop.status`)
- Disponibilité livreur (`DriverStatus` : online/offline/busy/paused) — nécessaire dès le premier livreur actif, pas une extension
- Écran mission simple (section 4.1) — déjà couvert par les specs existantes, à adapter au nouveau modèle de données sans changer l'expérience utilisateur actuelle

**P1 — première extension utile :**
- Livraison groupée / tournée pour vendeurs (section 1.2) — cas d'usage à fort potentiel de différenciation
- Livraison urgente et livraison programmée (section 2)
- Paiement à la réception / COD en direct (section 8, sans collecte sécurisée par la plateforme)
- Preuve de livraison et preuve de collecte par code OTP (sections 9 et 2 bis)
- Retour colis en cas d'échec (section 2 bis)
- Capacité de véhicule réelle (poids/volume, pas seulement un nombre max de colis)
- Heuristique d'optimisation simple ("plus proche voisin", section 6)
- Gestion des imprévus (section 7)

**P2 — extensions avancées :**
- Tournée/batching pour restaurants (section 1.3) — à réévaluer une fois le volume de commandes simultanées le justifie
- Entreprises avec livraison récurrente et contrats (section 1.4 / `RecurringDelivery`)
- Plusieurs livreurs pour une même livraison (colis lourd)
- Ramassage multiple / tournée inversée
- Offre de prix négociée par le livreur (`DeliveryOffer`)
- Score de difficulté de mission
- Structure `PaymentCollection` pour un futur COD sécurisé par la plateforme (table préparée mais inactive)
- Preuve de livraison/collecte par photo/signature (au-delà du simple code OTP)
- Carte de navigation intégrée (Option B, section 5)
- Vrai solveur d'optimisation de tournée

---

## 11. Critères de validation (definition of done pour le P0/P1)

- ✅ Le modèle de données supporte nativement une ou plusieurs livraisons par demande, sans nécessiter de migration lourde pour activer les tournées plus tard
- ✅ Une livraison unique existante continue de fonctionner exactement comme avant (pas de régression)
- ✅ Un vendeur peut créer une tournée avec plusieurs destinataires en une seule demande
- ✅ Le livreur voit une "mission" unique avec sa progression, jamais plusieurs cartes de commandes séparées pour une même tournée
- ✅ La navigation externe (Google Maps/Waze) fonctionne comme point de départ minimal viable
- ✅ Le code OTP de confirmation de livraison fonctionne pour chaque arrêt
- ✅ Le COD est correctement tracé (montant article vs frais de livraison distingués)

## Fichiers liés
- `spec-address-picker-map-v3.md` — le sélecteur d'adresse reste valide, réutilisé pour chaque `Stop`
- `spec-app-navigation-roles.md` — le solde/historique devra distinguer missions simples et tournées
- `spec-onboarding-livreur-v2.md` — capacité de véhicule et caution à connecter à ce modèle (notamment pour le COD)
- `ticket-precision-livreur.md` — le champ repère s'applique à chaque `Stop`, pas seulement à une livraison simple
