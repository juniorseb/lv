# Livrechap

La marketplace instantanée de livraison locale — Abidjan, Côte d'Ivoire.

**Publie. Trouve. Livre.**

## Structure du projet

```
livrechap-project/
├── mobile/          Application React Native (Expo) — Expéditeur + Livreur
├── backend/         API NestJS — Auth, Deliveries, Matching, Wallet, etc.
├── database/        Schéma PostgreSQL + PostGIS
└── docs/            Dossier projet complet (vision, roadmap, stack)
```

## Reprendre le projet dans Claude Code

Ce dépôt est un point de départ, pas un projet fini. Tout le raisonnement produit
(vision, cible, UX, matching, confiance, modèle économique, roadmap) est dans
`docs/livrechap-projet-complet.md` — à lire en premier pour garder le contexte.

### Étapes suggérées avec Claude Code

1. `cd backend && npm install` — installer les dépendances NestJS
2. Configurer `.env` à partir de `.env.example` (PostgreSQL, Redis, Firebase, Orange
   Money/Wave, Mapbox)
3. Lancer PostgreSQL avec PostGIS (`docker compose up -d` si tu ajoutes un
   `docker-compose.yml`, ou une base managée type Railway/Supabase)
4. Appliquer `database/schema.sql`
5. `npm run start:dev` côté backend
6. `cd mobile && npm install && npx expo start` — scanner le QR code avec
   l'app Expo Go sur ton téléphone

### Ce qui est déjà posé

- Arborescence des modules backend (un dossier par domaine métier)
- Schéma de base de données initial (utilisateurs, profils livreur/commerce,
  livraisons, portefeuille, transactions, notes)
- Squelette mobile Expo avec thème de couleurs Livrechap et navigation de base
- Variables d'environnement type

### Ce qu'il reste à faire (dans l'ordre logique)

1. Implémenter le module `auth` (OTP téléphone)
2. Implémenter `users` / `profiles` (particulier, livreur, commerce)
3. Implémenter `deliveries` (création, statuts, code de livraison)
4. Implémenter `matching` (cercle progressif PostGIS + Redis)
5. Implémenter `wallet` (crédit Livrechap, recharge, commission)
6. Brancher les notifications (Firebase Cloud Messaging)
7. Construire les écrans mobiles dans l'ordre du parcours Expéditeur, puis Livreur
8. Admin dashboard (validation CNI, litiges, statistiques)

## Identité

- Couleur principale : Orange `#FF8A00`
- Couleur secondaire : Bleu nuit `#14213D`
- Fond : Blanc `#FFFFFF`
