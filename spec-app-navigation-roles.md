# Spec — Architecture de navigation complète Livrechap
## Menu, gestion des rôles, solde livreur, caution

## Contexte
Livrechap gère deux profils d'usage sur un même compte : **expéditeur/client** (personne qui envoie/commande une livraison) et **livreur** (personne qui exécute les livraisons). Aujourd'hui, l'utilisateur doit re-choisir son rôle à chaque ouverture de l'app via deux boutons ("Livreur" / autre), ce qui casse la fluidité — un livreur régulier ne devrait jamais avoir à re-cliquer "Livreur" à chaque session.

Objectif de cette spec : transformer ça en une vraie architecture d'app, avec persistance du rôle actif, un menu hamburger complet, un accès clair au solde des gains et à la caution, et un historique des livraisons/expéditions.

---

## 1. Modèle de rôle utilisateur

### Principe
Un compte Livrechap peut avoir un ou deux rôles actifs :
- `client` (expéditeur)
- `livreur`

Un utilisateur peut être uniquement client, uniquement livreur, ou les deux (cas fréquent : quelqu'un qui livre parfois et commande aussi parfois).

### Données à stocker (backend, table `users` ou équivalent)
```json
{
  "userId": "uuid",
  "roles": ["client", "livreur"],
  "activeRole": "livreur",
  "livreurOnboardingComplete": true,
  "clientOnboardingComplete": true
}
```
- `roles` : liste des rôles pour lesquels l'utilisateur a terminé l'onboarding.
- `activeRole` : le rôle actuellement affiché par défaut à l'ouverture de l'app — **c'est la donnée clé qui résout le problème actuel**.
- Mis à jour côté backend à chaque bascule de rôle (section 6), pas seulement en local, pour que le choix survive à une réinstallation/reconnexion sur un autre appareil.

---

## 2. Comportement au lancement de l'app

```
Ouverture de l'app
        |
Utilisateur connecté ?
   |            |
  Non          Oui
   |            |
 Login    Lire `activeRole`
                |
      -----------------------
      |                     |
 activeRole = null    activeRole défini
 (première ouverture)        |
      |               Aller directement à
 Écran de choix         l'interface du rôle actif
 "Je veux..."          (Client → écran commandes/
  [Envoyer un colis]    historique ; Livreur →
  [Devenir livreur]     tableau de livraisons)
      |
 Onboarding du rôle choisi
      |
 activeRole = rôle choisi (sauvegardé backend + local)
      |
 Entrer dans l'interface correspondante
```

Point clé : **une fois `activeRole` défini, l'utilisateur n'a plus jamais à choisir son rôle au démarrage.** Il arrive directement sur l'interface de son rôle actif. Le changement de rôle ne se fait plus qu'à un seul endroit : le menu hamburger (section 6).

---

## 3. Menu hamburger — structure complète

Icône hamburger toujours accessible depuis l'interface principale (client comme livreur), généralement en haut à gauche.

### Section commune (visible peu importe le rôle actif)
```
☰ Menu
--------------------------------
👤 [Photo/Initiales] Nom complet
   [Rôle actif] · Voir mon profil
--------------------------------
🔄 Passer en mode [Client / Livreur]   ← bouton de bascule (section 6)
--------------------------------
📦 Historique des expéditions/livraisons
💳 Mon solde                            ← si rôle livreur uniquement
🔒 Ma caution                           ← si rôle livreur uniquement
📍 Mes adresses enregistrées            ← si rôle client
--------------------------------
⚙️ Paramètres
🆘 Aide / Support
--------------------------------
🚪 Déconnexion
```

### Spécifique au mode **Client**
- Historique des commandes passées (avec statut, date, montant, moyen de paiement)
- Adresses enregistrées (domicile, travail, favoris — réutilisation rapide pour les prochaines commandes)
- Moyens de paiement enregistrés (Orange Money, Wave)
- Lien "Devenir livreur" si l'utilisateur n'a pas encore ce rôle (déclenche l'onboarding livreur, cf. section 6)

### Spécifique au mode **Livreur**
- Historique des livraisons effectuées (avec statut, date, gain par course)
- **Mon solde** (section 4)
- **Ma caution** (section 5)
- Statistiques simples (nombre de livraisons, note moyenne si applicable)
- Lien "Repasser en mode client" (bascule, section 6)

### Justification du placement Solde vs Caution
- **Solde** (stats/revenu) : consultation fréquente, presque une donnée d'usage quotidien → accessible en un tap depuis le menu, éventuellement dupliquée en résumé sur l'écran d'accueil livreur (badge discret, ex. "342 livraisons · 890 000 FCFA gagnés").
- **Caution** (compte réel de commission) : consultation régulière aussi, mais avec un enjeu différent — le livreur doit savoir s'il risque un blocage pour recharge insuffisante. Alerte proactive plutôt que simple consultation passive.

---

## 4. Écran "Mon solde" — tableau de bord des gains (pas un portefeuille)

### Contenu
- **Nombre total de livraisons effectuées.**
- **Revenu total encaissé** par le livreur sur l'ensemble de ses courses — montant informatif, puisque **le client paie le livreur directement** (cash ou mobile money en direct) et que Livrechap n'encaisse jamais ce paiement.
- Historique des livraisons : chaque ligne = une course avec montant encaissé, date, référence.
- **Aucune fonction de retrait ici** — il n'y a rien à retirer, l'argent de la livraison est déjà chez le livreur au moment de la course. Ce n'est pas un portefeuille, c'est un suivi de performance/revenu.
- Filtre par période (semaine/mois) recommandé dès que le volume de courses est conséquent — cohérent avec l'historique (section 7).

### Rôle réel de cet écran
Aider le livreur à suivre son activité (combien il a livré, combien il a gagné), pas gérer un flux d'argent — le flux d'argent réel de la plateforme passe par la caution (section 5), pas par ce solde.

---

## 5. Écran "Ma caution" — mécanisme réel de collecte de la commission

### Principe
La caution n'est pas qu'un dépôt de garantie passif : **c'est par ce compte que Livrechap collecte sa commission de 10%.** À chaque livraison marquée comme terminée, le montant de la commission correspondante est **débité automatiquement de la caution** du livreur — pas prélevé sur un paiement qui transiterait par la plateforme (puisqu'il n'y en a pas).

### Contenu de l'écran
- Solde actuel de la caution.
- Historique des débits : chaque livraison terminée = une ligne "Livraison #1234 — Commission débitée : 200 FCFA".
- **Seuil d'alerte** : si la caution descend sous un montant minimum, alerte claire au livreur ("Rechargez votre caution pour continuer à recevoir des courses").
- **Bouton "Recharger ma caution"** via mobile money (Orange Money, MTN Money, Wave, Moov Money — cohérent avec les moyens de paiement collectés à l'onboarding).
- **Blocage des nouvelles courses** si la caution passe sous le seuil minimum, jusqu'à recharge — état à afficher clairement (pas une suspension punitive, juste une condition technique pour continuer à recevoir des missions).
- Conditions de remboursement de la caution restante si le livreur quitte la plateforme (délai raisonnable, ex. 7 jours ouvrés, sous réserve d'absence de litige en cours).

### Pourquoi ce mécanisme est cohérent avec le contexte
Puisque Livrechap ne collecte jamais le paiement du client, il n'y a pas d'autre moyen simple de garantir la collecte de la commission — la caution assure ce rôle : elle protège la marketplace (comme prévu initialement) ET sert de mécanisme de paiement de la commission par le livreur à la plateforme.

---

## 6. Bascule de rôle (switch client ↔ livreur)

### Comportement
- Bouton unique dans le menu hamburger : "Passer en mode Client" ou "Passer en mode Livreur" (le libellé affiche le rôle **vers lequel** on bascule, pas le rôle actuel).
- Cas 1 — l'utilisateur a déjà terminé l'onboarding pour les deux rôles : bascule instantanée, `activeRole` mis à jour, redirection immédiate vers l'interface de l'autre rôle.
- Cas 2 — l'utilisateur n'a pas encore de rôle livreur (ex. un client qui veut devenir livreur) : le tap sur "Passer en mode Livreur" déclenche l'onboarding livreur (documents, véhicule, etc. — cf. specs existantes si déjà définies), puis bascule automatiquement une fois complété.
- Après une bascule, `activeRole` est sauvegardé côté backend immédiatement, pour que la prochaine ouverture de l'app respecte ce choix (cf. section 2).

---

## 7. Historique des expéditions/livraisons

- Un historique par rôle (un client voit ses commandes passées, un livreur voit ses courses effectuées) — pas mélangés dans une seule liste, même si l'utilisateur a les deux rôles.
- Chaque entrée : date, statut final (livrée/annulée), montant, adresse résumée, et accès au détail complet de la course (trajet, personne concernée, éventuel repère livreur si renseigné — cf. `ticket-precision-livreur.md`).
- Filtre par période (semaine/mois) recommandé dès que le volume de courses devient conséquent.

---

## 8. Priorisation d'implémentation

**P0 — obligatoire pour rendre l'app "complète" :**
- Persistance de `activeRole` + comportement de lancement direct sur le bon rôle (section 2)
- Menu hamburger avec structure de base : profil, bascule de rôle, historique, déconnexion
- Bascule de rôle fonctionnelle (section 6)
- Écran historique par rôle (section 7)

**P1 — dès que les modèles économiques sont clarifiés :**
- Écran "Mon solde" complet (après clarification du point de la section 4)
- Écran "Ma caution" complet (après clarification du point de la section 5)
- Retrait vers Orange Money/Wave depuis l'écran solde, si applicable

**P2 — amélioration :**
- Statistiques livreur (nombre de courses, note moyenne)
- Filtres avancés sur l'historique
- Badge de solde résumé directement sur le tableau de bord livreur

---

## 9. Critères de validation (definition of done)

- ✅ Un livreur qui rouvre l'app arrive directement sur son tableau de livraisons, sans re-choisir son rôle
- ✅ Le menu hamburger est accessible depuis l'interface principale, quel que soit le rôle actif
- ✅ La bascule de rôle fonctionne dans les deux sens et persiste après fermeture/réouverture de l'app
- ✅ L'historique est correctement séparé par rôle
- ✅ Le solde et la caution sont accessibles depuis le menu, pas depuis l'écran principal (sauf badge résumé optionnel en P2)
- ✅ Un utilisateur qui n'a qu'un seul rôle ne voit pas d'option de bascule vers un rôle non pertinent sans passer par l'onboarding correspondant

## Points à valider avant de considérer le P1 comme définitif
1. Seuil minimum de caution avant blocage des nouvelles courses (montant précis à définir par toi) — section 5.
2. Montant initial de la caution à l'inscription (hypothèse d'exemple : 50 000 FCFA, voir `spec-onboarding-livreur-v2.md`) — section 5.

## Fichiers liés
- `spec-address-picker-map-v3.md` — sélecteur d'adresse (déjà livré/en cours)
- `ticket-precision-livreur.md` — champ repère livreur, référencé dans le détail de l'historique
- `spec-onboarding-livreur-identification.md` — pièces d'identification, véhicule, et détail des décisions par défaut sur paiement/caution
