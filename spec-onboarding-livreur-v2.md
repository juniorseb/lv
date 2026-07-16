# Spec — Onboarding, profil & identification du livreur Livrechap (v2)

## Contexte
Inspiré des standards DoorDash/Uber pour la vérification d'identité, permis, assurance et véhicule, adapté au contexte ivoirien (CNI, mobile money local, moto dominante) et aux valeurs Livrechap : confiance, sécurité, transparence, accessibilité. Objectif : ne pas juste "inscrire un livreur", mais créer un **profil professionnel vérifié**.

Cette version remplace `spec-onboarding-livreur-identification.md` (v1) — ne pas transmettre les deux à Claude Code, seule celle-ci fait foi.

---

## 1. Création du compte (commun à tous les utilisateurs)

### Informations personnelles
- Nom, prénoms
- Photo de profil
- Date de naissance
- Sexe (optionnel), nationalité (optionnel)
- Numéro de téléphone, adresse email
- Ville principale, commune/quartier de résidence

### Vérification
- Numéro de téléphone vérifié par OTP
- Email vérifié
- Identité vérifiée (CNI / passeport / carte de résident pour les étrangers)

---

## 2. Activation du mode livreur ("Devenir livreur")

Déclenché depuis le menu hamburger (cf. `spec-app-navigation-roles.md`, section 6 — bascule de rôle) si l'utilisateur n'a pas encore ce rôle.

### Étape 1 — Profil professionnel
- Nom complet, photo portrait obligatoire (distincte de la photo de profil générale — celle-ci doit être un vrai portrait clair)
- Numéro de téléphone
- Commune de résidence
- **Zones habituelles de livraison** (sélection multiple) : ex. Cocody, Plateau, Marcory, Yopougon, etc. — utilisé plus tard pour prioriser le matching livreur/course selon sa zone de confort.

### Étape 2 — Type de livreur (moyen de transport)
Choix unique parmi :
- 🏍 Moto (mode dominant attendu à Abidjan)
- 🚗 Voiture
- 🚲 Vélo
- 🚶 À pied
- 🚚 Camionnette

### Étape 3 — Informations véhicule (selon le type choisi à l'étape 2)

**Si moto :**
- Marque, modèle, année, couleur, cylindrée
- Numéro d'immatriculation
- Photo avant, photo arrière, photo plaque visible

**Si voiture :**
- Marque, modèle, année, couleur
- Type : Berline / SUV / Pick-up / Fourgonnette
- Documents : carte grise, assurance, visite technique

**Si vélo / à pied :** pas d'immatriculation ni d'assurance véhicule requise (aligné sur la pratique DoorDash pour les modes non motorisés).

### Étape 4 — Documents obligatoires

**Tous les livreurs :**
- CNI / Passeport (recto/verso)
- Selfie de vérification en direct (capturé dans l'app, pas d'upload galerie) — comparaison visage/document

**Pour moto :**
- Carte grise moto
- Assurance
- Permis de conduire catégorie A

**Pour voiture :**
- Carte grise
- Assurance automobile
- Visite technique
- Permis de conduire catégorie B

### Étape 5 — Informations financières
Mode de paiement pour recevoir les gains — mobile money (opérateurs actifs en Côte d'Ivoire) :
- ☑ Orange Money
- ☑ MTN Money
- ☑ Wave
- ☑ Moov Money

Champs : numéro de téléphone associé, nom du titulaire (doit correspondre à l'identité vérifiée).

### Étape 6 — Caution livreur

```
Caution de sécurité
Votre caution : 0 FCFA
Objectif : [montant à définir — ex. 50 000 FCFA]
Statut : ❌ Non activée
[Ajouter une caution]
```

⚠️ Le montant affiché ci-dessus est un **exemple/placeholder**, pas une valeur validée — voir section 8 pour la décision par défaut et ses limites.

Objectif de la caution : renforcer la confiance côté client, limiter les comportements frauduleux, protéger la marketplace.

---

## 3. Profil public du livreur (vu par le client)

```
🛵 Jean Kouassi
⭐ 4.8 / 5
Livraisons réalisées : 342
Membre depuis : 2026

Véhicule :
🏍 Yamaha XTZ — CI-1234-AA

Badges :
✅ Identité vérifiée
✅ Véhicule vérifié
⭐ Livreur recommandé
```

Affiché au client au moment où un livreur est assigné à sa course — renforce la confiance, cohérent avec l'objectif "carte crédible et rassurante".

---

## 4. Statuts du livreur

| Statut | Signification |
|---|---|
| 🟡 En validation | Documents soumis, en cours d'analyse — ne peut pas encore recevoir de missions |
| 🟢 Actif | Validé, peut recevoir des missions |
| 🔴 Suspendu | Problème de document (expiré, invalide) ou de comportement signalé |

Le statut doit être visible par le livreur lui-même (pourquoi il ne reçoit pas de courses) et piloté côté admin/backoffice pour la validation manuelle en V1.

---

## 5. Centre de documents (dans le menu hamburger)

```
☰ Documents
Identité      ✅ Validée
Permis        ✅ Validé
Véhicule      ✅ Validé
Assurance     ⚠️ Expire dans 15 jours
```

- Alerte visuelle dès qu'un document approche de son expiration (seuil recommandé : 30 jours avant, puis rappel à 7 jours).
- Accès direct pour re-uploader un document renouvelé sans repasser par tout l'onboarding.
- Lié au champ `date_expiration` du schéma backend (section 9).

---

## 6. Gestion de plusieurs véhicules

```
Mes véhicules
🏍 Yamaha XTZ — Active
🚗 Toyota Corolla — Inactive
[Ajouter un véhicule]
```

- Un livreur peut déclarer plusieurs véhicules, mais un seul est "actif" à la fois (celui utilisé pour la session de livraison en cours).
- Chaque véhicule a ses propres documents (carte grise, assurance, visite technique si voiture) — pas de mutualisation des documents entre véhicules.

---

## 7. Badges de confiance différenciants

- 🏆 **Livreur fiable** — attribué après un seuil de livraisons réussies (ex. 100+)
- 📍 **Expert [Quartier]** — attribué selon la zone où le livreur a le plus livré (ex. "Expert Cocody")
- ⚡ **Livraison rapide** — attribué selon un temps de livraison moyen sous un seuil donné

Ces badges sont un vrai levier de différenciation locale face à Yango — à calculer en tâche de fond (batch quotidien/hebdomadaire côté backend), pas en temps réel.

---

## 8. Modèle de paiement et de caution (confirmé)

### Paiement du livreur
**Le client paie le livreur directement** (cash ou mobile money en direct, hors app) au moment de la livraison. Livrechap n'encaisse jamais ce paiement et n'a donc aucun rôle de portefeuille/retrait à jouer côté livreur.

### Caution — mécanisme réel de collecte de la commission
Puisque Livrechap ne collecte pas le paiement de la course, la **caution sert de mécanisme de collecte de la commission de 10%** :
- À l'inscription, le livreur verse une caution initiale via mobile money (Orange Money, MTN Money, Wave, Moov Money).
- À chaque livraison terminée, le montant de la commission correspondante est **automatiquement débité de la caution**.
- Si la caution passe sous un seuil minimum, le livreur ne peut plus recevoir de nouvelles courses tant qu'il ne l'a pas rechargée.
- Remboursable (solde restant) si le livreur quitte la plateforme sans litige en cours, après délai raisonnable (ex. 7 jours ouvrés).
- Partiellement prélevable en cas de litige avéré (colis perdu/endommagé, comportement signalé), en plus des débits de commission normaux.

Le **montant initial de la caution** (exemple donné : 50 000 FCFA) et le **seuil minimum avant blocage** restent des arbitrages business à valider par toi — voir `spec-app-navigation-roles.md` section 5 pour l'écran correspondant.

### Solde (écran séparé, purement informatif)
Le solde du livreur n'est **pas** un portefeuille : c'est un tableau de bord affichant le nombre de livraisons effectuées et le revenu total encaissé directement par le livreur — aucune fonction de retrait, puisqu'il n'y a rien détenu par Livrechap à ce niveau.

---

## 9. Schéma de base de données recommandé

```
users
  id, nom, prenoms, telephone, email, role

drivers
  id, user_id, status, rating, total_deliveries, caution_balance, zones_livraison

vehicles
  id, driver_id, type, marque, modele, annee, couleur, immatriculation, is_active

driver_documents
  id, driver_id, vehicle_id (nullable, pour les documents liés à un véhicule précis),
  type_document, url, status, date_expiration

wallets
  id, driver_id, total_livraisons, total_revenu_encaisse
  # purement informatif — pas de fonction de retrait, le livreur détient déjà l'argent de chaque course

caution_transactions
  id, driver_id, delivery_id (nullable), type (commission / recharge / litige / remboursement),
  montant, date, solde_apres_transaction

deliveries
  id, client_id, driver_id, statut, prix, commission
```

Note : `zones_livraison` sur `drivers` (pas une table séparée) suffit en V1 si c'est une simple liste de quartiers ; à normaliser en table séparée si le nombre de zones ou leur usage analytique grandit.

---

## 10. Ce qu'on ne reproduit pas de DoorDash (différences volontaires)

- Pas de Social Security Number (inexistant en Côte d'Ivoire) — remplacé par CNI/passeport.
- Pas de background check automatisé type Checkr (non disponible localement en V1) — revue manuelle des documents à l'inscription ; un service tiers type Regula (déjà utilisé sur YURE POS) pourra être introduit en V2 si le volume le justifie.
- Pas d'exigence de compte bancaire — le mobile money remplace ce rôle.

---

## 11. Priorisation d'implémentation

**P0 — obligatoire pour ouvrir l'onboarding livreur :**
- Compte utilisateur commun (section 1)
- Étapes 1 à 5 de l'onboarding livreur (profil, type, véhicule, documents, paiement)
- Statuts En validation / Actif / Suspendu (section 4)
- Schéma backend de base (section 9, sans `zones_livraison` avancé)

**P1 :**
- Caution (étape 6) avec montant à valider par toi
- Centre de documents avec alertes d'expiration (section 5)
- Profil public livreur (section 3)
- Gestion multi-véhicules (section 6)

**P2 :**
- Badges de confiance (section 7)
- Vérification automatisée d'identité (Regula ou équivalent)
- Zones de livraison utilisées activement dans l'algorithme de matching (au-delà du simple stockage)

---

## 12. Critères de validation (definition of done)

- ✅ Un utilisateur peut passer du rôle client au rôle livreur via un onboarding complet et guidé
- ✅ Tous les documents obligatoires selon le type de véhicule sont collectés avant activation
- ✅ Le statut du livreur (validation/actif/suspendu) est visible et compréhensible pour lui
- ✅ Le profil public livreur s'affiche correctement côté client au moment de l'assignation
- ✅ Les documents expirants déclenchent une alerte avant expiration, pas après
- ✅ Un livreur peut gérer plusieurs véhicules sans confusion entre leurs documents respectifs
- ✅ Le montant de caution reste configurable côté admin, pas une valeur codée en dur

## Fichiers liés
- `spec-app-navigation-roles.md` — bascule de rôle, écrans solde/caution dans le menu
- `ticket-precision-livreur.md` — champ repère livreur (complémentaire, pas redondant)

## Fichier obsolète
- `spec-onboarding-livreur-identification.md` (v1) — remplacé par ce document, ne plus utiliser.
