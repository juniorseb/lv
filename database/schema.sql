-- Livrechap — Schéma de base de données initial
-- PostgreSQL + PostGIS

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- UTILISATEURS
-- ============================================================

CREATE TYPE account_type AS ENUM ('particulier', 'commerce');
CREATE TYPE verification_level AS ENUM ('standard', 'verifie');
CREATE TYPE id_document_type AS ENUM ('cni', 'passeport');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  phone_verified BOOLEAN DEFAULT FALSE,
  account_type account_type NOT NULL DEFAULT 'particulier',
  full_name VARCHAR(150),
  selfie_url TEXT,
  commune VARCHAR(100),
  verification_level verification_level NOT NULL DEFAULT 'standard',
  id_document_url TEXT, -- pièce d'identité (CNI ou passeport)
  id_document_type id_document_type,
  is_active BOOLEAN DEFAULT TRUE,
  is_admin BOOLEAN DEFAULT FALSE, -- accès back-office (validation CNI, litiges, stats)
  active_role VARCHAR(20),        -- 'client' | 'livreur' : rôle affiché au lancement (null = pas encore choisi)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PROFIL COMMERCE (compte Commerce — vendeuses, boutiques)
-- ============================================================

CREATE TABLE commerce_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name VARCHAR(150),
  default_address TEXT,
  default_location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PROFIL LIVREUR
-- ============================================================

CREATE TYPE vehicle_type AS ENUM ('moto', 'voiture', 'velo', 'a_pied', 'camionnette');

CREATE TABLE driver_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type vehicle_type NOT NULL,
  -- Statut de validation (spec-onboarding-livreur-v2 §4) : en_validation par
  -- défaut ; seul un livreur 'actif' reçoit des missions.
  status VARCHAR(20) NOT NULL DEFAULT 'en_validation',
  -- Zones de livraison (communes/quartiers), liste séparée par des virgules.
  zones VARCHAR(300),
  -- Compte mobile money d'alimentation de la caution (spec §1 étape 5) : compte
  -- DEPUIS lequel le livreur verse/recharge sa caution. Livrechap ne verse rien.
  mobile_money_operator VARCHAR(10),
  mobile_money_number VARCHAR(20),
  mobile_money_holder VARCHAR(150),
  is_available BOOLEAN DEFAULT FALSE,
  current_location GEOGRAPHY(POINT, 4326),
  location_updated_at TIMESTAMPTZ,
  rating_average NUMERIC(2,1) DEFAULT 5.0,
  total_deliveries INTEGER DEFAULT 0,
  no_show_count INTEGER DEFAULT 0,
  suspended_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index géospatial : cœur du moteur de matching par cercle progressif
CREATE INDEX idx_driver_location ON driver_profiles USING GIST (current_location);
CREATE INDEX idx_driver_available ON driver_profiles (is_available) WHERE is_available = TRUE;
CREATE INDEX idx_driver_status ON driver_profiles (status);

-- Documents du livreur (spec-onboarding-livreur-v2 §1 étape 4) : pièce d'identité
-- recto/verso, selfie live, et selon le véhicule permis/carte grise/assurance/
-- visite technique. Un document courant par type (remplacement à chaque envoi).
CREATE TABLE driver_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  type_document VARCHAR(30) NOT NULL,
  url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'en_attente',
  date_expiration DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_driver_document_driver ON driver_documents (driver_id);

-- Véhicule du livreur (spec-onboarding-livreur-v2 §1 étape 3 + §9). Table dédiée
-- pour préparer le multi-véhicules ; un seul véhicule actif par livreur en V1.
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  vehicle_type vehicle_type NOT NULL,
  marque VARCHAR(60),
  modele VARCHAR(60),
  annee INTEGER,
  couleur VARCHAR(40),
  immatriculation VARCHAR(30),
  photo_avant_url TEXT,
  photo_arriere_url TEXT,
  photo_plaque_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_vehicle_driver ON vehicles (driver_id);

-- Adresses enregistrées du client (spec-app-navigation-roles §3 « Mes adresses »).
CREATE TABLE saved_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(60) NOT NULL,
  address VARCHAR(300) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  landmark VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_saved_address_user ON saved_addresses (user_id);

-- ============================================================
-- Modèle logistique généralisé (spec-delivery-architecture-tournees §3)
-- Une demande logistique = 1..N livraisons ; une livraison = 1..N arrêts.
-- La livraison simple (table `deliveries`) est reflétée ici : DeliveryRequest
-- (single) → Route → Stop → Package. `deliveries` reste le record opérationnel.
-- ============================================================

CREATE TABLE delivery_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL DEFAULT 'single',       -- single / batch / route / recurring
  depart_address TEXT,
  depart_location GEOGRAPHY(POINT, 4326),
  status_global VARCHAR(20) NOT NULL DEFAULT 'en_cours',
  total_price_fcfa INTEGER NOT NULL DEFAULT 0,
  urgency VARCHAR(10) NOT NULL DEFAULT 'normal',    -- normal / urgent / express
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_delivery_request_status ON delivery_requests (status_global);

CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_request_id UUID NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES driver_profiles(id),
  distance_estimee_m NUMERIC(10,1),
  gain_total_fcfa INTEGER,
  commission_totale_fcfa INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'en_attente', -- en_attente / en_cours / terminee / annulee
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_route_request ON routes (delivery_request_id);
CREATE INDEX idx_route_driver ON routes (driver_id);

CREATE TABLE stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  recipient_name VARCHAR(150),
  recipient_phone VARCHAR(20),
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  landmark VARCHAR(150),
  price_fcfa INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'en_attente', -- en_attente / en_route / livre / probleme / retour
  proof_otp CHAR(4),
  proof_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_stop_route ON stops (route_id);

CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  description_produit TEXT,
  valeur_declaree_fcfa INTEGER,
  poids_kg NUMERIC(6,2),
  fragile BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'cree',        -- cree / assigne / recupere / en_transport / livre / retour
  proof_collection_photo_url TEXT,
  proof_collection_code VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_package_stop ON packages (stop_id);

-- Articles d'une livraison (spec-delivery-items) : quoi remettre à chaque
-- destinataire. Aucune donnée commerciale (prix/marge/coût).
CREATE TABLE delivery_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / delivered / missing
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_delivery_item_stop ON delivery_items (stop_id);

-- Messagerie de mission (spec-communication) : une livraison = une conversation
-- entre l'expéditeur et le livreur assigné. Texte seul.
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  sender_role VARCHAR(10) NOT NULL, -- client / livreur
  body VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_message_delivery ON messages (delivery_id);

-- Livrechap Protect (spec-protect) : alertes de sécurité pendant une livraison.
-- Contact d'urgence (prévenu par SMS) stocké sur users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);

CREATE TABLE sos_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(10) NOT NULL,               -- client / livreur
  delivery_id UUID REFERENCES deliveries(id),
  latitude NUMERIC(9,6) NOT NULL,          -- position au déclenchement
  longitude NUMERIC(9,6) NOT NULL,
  last_latitude NUMERIC(9,6),              -- position live (partage GPS)
  last_longitude NUMERIC(9,6),
  location_updated_at TIMESTAMPTZ,
  status VARCHAR(10) NOT NULL DEFAULT 'active', -- active / resolved
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sos_user ON sos_alerts (user_id);
CREATE INDEX idx_sos_status ON sos_alerts (status);

CREATE TABLE tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  type_evenement VARCHAR(40) NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tracking_package ON tracking_events (package_id);

-- Lien de la livraison simple vers sa demande logistique (bridge).
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_request_id UUID REFERENCES delivery_requests(id);

-- Tables réservées mais INACTIVES en V1 (réservation de schéma, spec §2 bis/§10).
CREATE TABLE payment_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL,
  montant_a_collecter_fcfa INTEGER NOT NULL,
  livreur_collecteur_id UUID,
  statut VARCHAR(20) NOT NULL DEFAULT 'en_attente',
  date_reception TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE delivery_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_request_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  prix_propose_fcfa INTEGER NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'en_attente',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recurring_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL,
  frequency VARCHAR(20) NOT NULL,
  heure_depart VARCHAR(5),
  livreur_prefere_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE vehicle_capacity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL,
  capacite_poids_kg INTEGER,
  capacite_volume_litres INTEGER,
  capacite_max_colis INTEGER
);

-- ============================================================
-- PORTEFEUILLE — CRÉDIT LIVRECHAP
-- ============================================================

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE UNIQUE,
  balance_fcfa INTEGER NOT NULL DEFAULT 0,
  welcome_bonus_claimed BOOLEAN DEFAULT FALSE,
  low_balance_alert_threshold INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE wallet_transaction_type AS ENUM ('recharge', 'commission', 'bonus', 'ajustement');
CREATE TYPE payment_provider AS ENUM ('orange_money', 'wave', 'systeme');

CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type wallet_transaction_type NOT NULL,
  amount_fcfa INTEGER NOT NULL, -- positif = crédit, négatif = débit
  provider payment_provider,
  provider_reference VARCHAR(150),
  delivery_id UUID, -- référence FK ajoutée après création de la table deliveries
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- LIVRAISONS
-- ============================================================

-- `expiree` : le délai de recherche est dépassé sans qu'aucun livreur n'accepte.
-- Distinct d'`annulee` (personne n'a annulé) ; le client peut republier.
CREATE TYPE delivery_status AS ENUM (
  'recherche',
  'livreur_trouve',
  'colis_recupere',
  'terminee',
  'annulee',
  'expiree'
);

CREATE TYPE matching_mode AS ENUM ('rapide', 'choix');

CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID REFERENCES driver_profiles(id),

  pickup_address TEXT NOT NULL,
  pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,

  recipient_name VARCHAR(150),  -- destinataire du colis
  recipient_phone VARCHAR(20),  -- pour que le livreur puisse l'appeler
  -- Contact au point de RÉCUPÉRATION : la personne qui remet le colis. Par défaut
  -- l'expéditeur, mais pas toujours (« je commande pour un ami dans une autre
  -- commune »). Symétrique de recipient_*.
  pickup_contact_name VARCHAR(150),
  pickup_contact_phone VARCHAR(20),
  -- Repères humains pour le livreur (ex: « portail orange »), un par adresse :
  -- il doit trouver le point de récupération autant que celui de livraison.
  pickup_note VARCHAR(150),
  dropoff_note VARCHAR(150),

  price_fcfa INTEGER NOT NULL,
  package_type VARCHAR(50), -- documents, vetements, alimentation, petit_colis, autre
  description TEXT,
  photo_url TEXT, -- optionnelle

  matching_mode matching_mode NOT NULL DEFAULT 'rapide',
  search_radius_km NUMERIC(4,1) DEFAULT 2.0, -- rayon courant du cercle progressif
  status delivery_status NOT NULL DEFAULT 'recherche',
  delivery_code CHAR(4), -- code à 4 chiffres, généré à la publication

  -- Options de course (spec-tournees §2/§8)
  urgency VARCHAR(10) NOT NULL DEFAULT 'normal',       -- normal / urgent / express
  scheduled_at TIMESTAMPTZ,                             -- programmée : hors feed tant que future
  -- Limite de la recherche : au-delà, la course sort de tous les feeds et passe
  -- en `expiree` (le livreur voit un décompte sur le bouton Accepter).
  expires_at TIMESTAMPTZ,
  -- Dernier palier du cercle progressif notifié (0 = palier initial, à la
  -- publication). Évite de re-notifier les mêmes livreurs à chaque balayage.
  notified_ring_index INTEGER NOT NULL DEFAULT 0,
  is_cod BOOLEAN NOT NULL DEFAULT FALSE,               -- paiement à la réception
  cod_article_amount_fcfa INTEGER,                     -- montant article à collecter (COD)

  delivery_request_id UUID REFERENCES delivery_requests(id), -- lien modèle généralisé (bridge)

  created_at TIMESTAMPTZ DEFAULT now(),
  matched_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason VARCHAR(40) -- motif d'annulation choisi par l'expéditeur
);

CREATE INDEX idx_deliveries_pickup_location ON deliveries USING GIST (pickup_location);
CREATE INDEX idx_deliveries_status ON deliveries (status);
-- Balayage du job d'expiration + filtrage du feed.
CREATE INDEX idx_deliveries_expires_at ON deliveries (expires_at);

ALTER TABLE wallet_transactions
  ADD CONSTRAINT fk_wallet_transactions_delivery
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id);

-- ============================================================
-- INCIDENTS (no-show / annulations)
-- ============================================================

CREATE TYPE incident_type AS ENUM ('no_show_livreur', 'annulation_client', 'refus_apres_acceptation');

CREATE TABLE delivery_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id),
  user_id UUID NOT NULL REFERENCES users(id), -- personne responsable de l'incident
  type incident_type NOT NULL,
  reason VARCHAR(40), -- motif choisi (ex. annulation client)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- JETONS D'APPAREIL (notifications push FCM)
-- ============================================================

CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'android', -- android, ios, web
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_device_tokens_user ON device_tokens (user_id);

-- Tickets Expo en attente de verdict. Expo répond « accepté » à l'envoi ; le
-- sort réel du push (livré, appareil disparu, clé FCM invalide) n'est connu
-- qu'ensuite, en réclamant le reçu avec l'identifiant du ticket. Éphémère :
-- chaque ligne est supprimée dès son verdict rendu.
CREATE TABLE push_receipts (
  ticket_id VARCHAR(100) PRIMARY KEY,
  token TEXT NOT NULL,           -- pour purger l'appareil s'il a disparu
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_receipts_created_at ON push_receipts (created_at);

-- ============================================================
-- NOTES ET BADGES
-- ============================================================

CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id),
  rated_user_id UUID NOT NULL REFERENCES users(id), -- personne évaluée
  rater_user_id UUID NOT NULL REFERENCES users(id), -- personne qui évalue
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Badge "Client fiable" : calculé (vue ou job planifié), pas stocké en dur
-- Conditions de référence : plus de 10 livraisons terminées,
-- taux de réussite > 90 %, note moyenne >= 4/5
CREATE VIEW reliable_clients AS
SELECT
  u.id AS user_id,
  COUNT(d.id) FILTER (WHERE d.status = 'terminee') AS completed_deliveries,
  COUNT(d.id) FILTER (WHERE d.status = 'terminee')::FLOAT
    / NULLIF(COUNT(d.id), 0) AS completion_rate,
  AVG(r.score) AS average_rating
FROM users u
JOIN deliveries d ON d.sender_id = u.id
LEFT JOIN ratings r ON r.rated_user_id = u.id
GROUP BY u.id
HAVING COUNT(d.id) FILTER (WHERE d.status = 'terminee') > 10
  AND COUNT(d.id) FILTER (WHERE d.status = 'terminee')::FLOAT / NULLIF(COUNT(d.id), 0) > 0.9
  AND AVG(r.score) >= 4;

-- ============================================================
-- Exemple de requête cœur du matching : cercle progressif
-- Trouver les livreurs disponibles dans un rayon donné (mètres),
-- triés par distance, autour d'un point de récupération
-- ============================================================
-- SELECT dp.*, ST_Distance(dp.current_location, :pickup_point) AS distance_m
-- FROM driver_profiles dp
-- WHERE dp.is_available = TRUE
--   AND (dp.suspended_until IS NULL OR dp.suspended_until < now())
--   AND ST_DWithin(dp.current_location, :pickup_point, :radius_meters)
-- ORDER BY distance_m ASC, dp.rating_average DESC
-- LIMIT 20;
