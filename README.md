# Livrechap

La marketplace instantanée de livraison locale — Abidjan, Côte d'Ivoire.

**Publie. Trouve. Livre.**

Le client publie une course et fixe son prix. Les livreurs disponibles autour du
point de récupération la voient et l'acceptent. **Le client paie le livreur en
direct** : Livrechap ne fait que prélever une commission sur un crédit interne.

## Structure

```
livrechap-project/
├── backend/         API NestJS — auth, deliveries, matching, wallet, tournées…
├── mobile/          Application Expo (React Native) — Expéditeur + Livreur
├── admin/           Back-office React (Vite) — validation, suivi, alertes
├── database/        Schéma de référence (historique — voir « Migrations »)
└── docs/            Dossier projet (vision, cible, UX, modèle économique)
```

## Démarrer

```bash
# 1. Base de données (PostgreSQL + PostGIS) et Redis
docker compose up -d

# 2. Backend
cd backend
npm install
cp .env.example .env          # ajuster si besoin (DB_PORT=5433 par défaut)
npm run migration:run         # crée le schéma
npm run start:dev             # http://localhost:3000

# 3. Mobile (Expo Go sur téléphone)
cd ../mobile
npm install --legacy-peer-deps
npx expo start                # scanner le QR code

# 4. Back-office
cd ../admin
npm install
npm run dev
```

En développement, le code OTP est fixe : **`000000`** (`OTP_DEV_BYPASS_CODE`).
Il est neutralisé de force dès que `NODE_ENV=production`.

Un administrateur se crée en base : `UPDATE users SET is_admin = true WHERE …`.

## Ce qui est construit

**Backend** — auth OTP (code haché, anti-abus, JWT access/refresh) · profils
particulier / livreur / commerce · livraisons avec code de remise à 4 chiffres ·
matching PostGIS à **cercle progressif temporel** (2 km, puis 5 km à 15 s, puis
10 km à 30 s) · plafonds propres aux vélos et livreurs à pied · expiration de la
recherche après 3 min · tournées multi-arrêts avec négociation de prix ·
portefeuille-caution et commission · messagerie de mission · Livrechap Protect
(SOS) · uploads · géocodage.

**Mobile** — parcours Expéditeur complet (publication, suivi carte, republication)
et Livreur (disponibilité, feed avec décompte, mission, caution, documents,
véhicules), bascule de rôle, historique, messagerie, SOS.

**Back-office** — statistiques, validation des pièces d'identité, validation et
suspension des livreurs, alertes SOS en temps réel.

### Deux notions à ne pas confondre

- **L'auteur de la commande** (`sender_id`) publie et paie. Lui seul peut annuler
  ou republier.
- **Le contact de récupération** (`pickup_contact_*`) remet le colis. Ce n'est pas
  forcément la même personne : « je commande depuis Marcory pour un ami à
  Yopougon ». Ne l'appelez jamais « l'expéditeur » dans l'interface.

## Tests

```bash
cd backend
npm test          # 34 tests unitaires (commission, plafonds, numéros, vues)
npm run test:e2e  # 29 tests e2e sur une base jetable (livrechap_test)
```

Les e2e démarrent une vraie application contre une base créée et détruite
automatiquement : ils ne touchent jamais la base de développement.

## Push

Les notifications passent par le **service Expo** (`exp.host`), qui relaie vers
FCM et APNs. Pas de `firebase-admin` : le jeton natif renvoyé par iOS est un
jeton APNs brut, qu'un envoi FCM ne sait pas adresser — Expo unifie les deux
derrière un seul format. **Le backend ne porte aucun secret pour les push.**

Pour activer :

```bash
cd mobile
npx eas init            # écrit extra.eas.projectId dans app.json
npx eas credentials     # une fois : clé FCM (Android) et clé APNs (iOS)
```

Puis `PUSH_MODE=live` côté backend. Tant qu'aucun `projectId` n'existe, le mobile
journalise un avertissement et n'enregistre aucun appareil — les push sont
simplement inactifs, rien ne casse.

Les jetons refusés par Expo (`DeviceNotRegistered`, app désinstallée) sont
supprimés automatiquement de `device_tokens`.

**Accusés de réception.** Expo ne répond à l'envoi que « accepté » : le sort réel
du push arrive plus tard, via un reçu à réclamer. Un job (`PushReceiptJob`) va le
chercher et purge les appareils disparus. C'est ce qui révèle les pannes
silencieuses — notamment `MismatchSenderId` (clé FCM erronée), qui fait échouer
**tous** les push Android sans qu'aucune erreur n'apparaisse à l'envoi.

```
PUSH_RECEIPT_DELAY_SECONDS=900   # attendre avant de réclamer le verdict
PUSH_RECEIPT_SWEEP_SECONDS=300   # fréquence de collecte (mode live uniquement)
```

## Migrations

Le schéma est produit **uniquement** par les migrations TypeORM
(`backend/src/migrations/`).

```bash
npm run migration:generate src/migrations/NomExplicite   # après une modif d'entité
npm run migration:run
npm run migration:revert
```

En développement, `synchronize` est actif : **toute modification d'entité doit
s'accompagner d'une migration**, sinon la production dérive.

`database/schema.sql` est un document historique : il diverge du schéma réel
(TypeORM nomme les enums `<table>_<colonne>_enum`). La source de vérité est la
migration.

## Ce qui n'est pas fait

- **Notifications push** — l'envoi via Expo est implémenté (`PUSH_MODE=live`), mais
  il faut **`eas init`** pour obtenir un `projectId` : sans lui, le mobile
  n'émet aucun jeton et rien ne part. Voir « Push » ci-dessous.
- **SMS** — `SMS_PROVIDER=console` : les codes OTP, le code de livraison envoyé au
  destinataire et les alertes SOS ne font que s'écrire dans les logs.
- **Paiements** — `PAYMENTS_MODE=sandbox` : les recharges créditent sans encaisser.
  L'agrégateur (Genius Pay) n'est pas intégré.
- **Stockage** — `STORAGE_MODE=local` : les fichiers restent sur le disque.
- **Litiges** — la table `delivery_incidents` se remplit, mais aucun écran ni
  endpoint ne permet de les consulter.
- **Tests mobile / admin** — aucun.

En clair : l'application est complète côté logique métier, mais **aucun
utilisateur réel ne peut encore s'inscrire** tant que les seams ci-dessus ne sont
pas branchés sur de vrais fournisseurs.

## Identité

- Orange `#F97316` — action, rapidité, énergie
- Bleu nuit `#14213D` — confiance, sécurité
- Blanc `#FFFFFF` — clarté, simplicité
- Typographie : Manrope
