import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DeliveriesService } from '../deliveries/deliveries.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DriverProfilesService } from '../profiles/driver-profiles.service';
import { VehicleCapsService } from '../vehicle-caps/vehicle-caps.service';
import { DriverPresenceCache } from './driver-presence.cache';
import {
  DriverCard,
  DriverSearchResult,
  MissionCard,
  rowToDriverCard,
  rowToMissionCard,
} from './matching.view';

// Distance-seuil effective d'une ligne livreur selon son type de véhicule : les
// modes doux (vélo, à pied) sont bornés par LEAST(rayon, plafond du mode) ; un
// plafond à 0 les exclut. `radius`/`velo`/`apied` sont des placeholders SQL ($n).
function softCapDistanceSql(radius: string, velo: string, apied: string): string {
  return `CASE dp.vehicle_type
          WHEN 'velo' THEN LEAST(${radius}::float8, ${velo}::float8)
          WHEN 'a_pied' THEN LEAST(${radius}::float8, ${apied}::float8)
          ELSE ${radius}::float8
        END`;
}

// Moteur de matching — recherche par cercle progressif (dossier §5).
//
// Côté client (expéditeur) : autour du point de récupération, on cherche des
// livreurs disponibles dans un rayon initial (≈2 km), élargi automatiquement
// (5 km, 10 km) tant qu'aucun livreur n'est trouvé. Le compteur affiché est
// recalculé à chaque rayon.
//
// Côté livreur : feed des missions ouvertes proches, distance d'approche et
// distance de course calculées séparément.
//
// La source de vérité géographique est PostGIS (index GIST sur
// driver_profiles.current_location et deliveries.pickup_location).
@Injectable()
export class MatchingService {
  private readonly radiiKm: number[];
  // Cadence d'ouverture des paliers du cercle progressif (secondes).
  private readonly ringStepSeconds: number;
  private readonly maxDrivers = 20;
  private readonly feedLimit = 30;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly deliveries: DeliveriesService,
    private readonly driverProfiles: DriverProfilesService,
    private readonly presence: DriverPresenceCache,
    private readonly notifications: NotificationsService,
    // Politique de plafonnement des modes doux (partagée avec deliveries).
    private readonly vehicleCaps: VehicleCapsService,
  ) {
    const initial = Number(this.config.get('MATCHING_INITIAL_RADIUS_KM')) || 2;
    const steps = (this.config.get<string>('MATCHING_RADIUS_STEPS_KM') ?? '5,10')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    // Rayons croissants, dédupliqués et triés (ex: [2, 5, 10]).
    this.radiiKm = Array.from(new Set([initial, ...steps])).sort((a, b) => a - b);
    this.ringStepSeconds =
      Number(this.config.get('MATCHING_RING_STEP_SECONDS')) || 15;
  }

  // --- Cercle progressif dans le TEMPS -------------------------------------
  //
  // Un palier s'ouvre tous les `ringStepSeconds` (15 s par défaut, l'ordre de
  // grandeur des offres Uber/Lyft) : 2 km à 0 s, 5 km à 15 s, 10 km à 30 s. Le
  // livreur le plus proche a donc une courte longueur d'avance, pas un monopole.
  //
  // L'échéance reste GLOBALE (expires_at) : un palier tardif hérite du temps
  // restant, il n'en gagne pas. Avec une fenêtre de 180 s : 2 km → 180 s,
  // 5 km → 165 s, 10 km → 150 s.

  // Secondes écoulées depuis que la course est réellement proposable.
  private elapsedSeconds(delivery: {
    createdAt: Date;
    scheduledAt: Date | null;
  }): number {
    const liveStart = (delivery.scheduledAt ?? delivery.createdAt).getTime();
    return Math.max((Date.now() - liveStart) / 1000, 0);
  }

  // Index du palier actuellement ouvert.
  private currentRingIndex(delivery: {
    createdAt: Date;
    scheduledAt: Date | null;
  }): number {
    const n = this.radiiKm.length;
    const step = this.ringStepSeconds;
    if (step <= 0) return n - 1; // pas de progressivité : tout ouvert
    const index = Math.floor(this.elapsedSeconds(delivery) / step);
    return Math.min(index, n - 1);
  }

  // Rayon actuellement ouvert (km) pour une livraison.
  private currentRingKm(delivery: {
    createdAt: Date;
    scheduledAt: Date | null;
  }): number {
    return this.radiiKm[this.currentRingIndex(delivery)];
  }

  // Même règle, exprimée en SQL (le feed évalue N livraisons d'un coup).
  // Renvoie le rayon ouvert EN MÈTRES, à comparer à la distance d'approche.
  private ringRadiusSql(elapsedExpr: string): string {
    const n = this.radiiKm.length;
    const step = this.ringStepSeconds;
    if (n === 1 || step <= 0) return String(this.radiiKm[n - 1] * 1000);
    const whens = this.radiiKm
      .slice(0, n - 1)
      .map((km, i) => `WHEN ${elapsedExpr} < ${(i + 1) * step} THEN ${km * 1000}`)
      .join(' ');
    return `CASE ${whens} ELSE ${this.radiiKm[n - 1] * 1000} END`;
  }

  // Palier (index) auquel appartient un livreur, d'après sa distance d'approche.
  private ringIndexSql(approachExpr: string): string {
    const n = this.radiiKm.length;
    if (n === 1) return '0';
    const whens = this.radiiKm
      .slice(0, n - 1)
      .map((km, i) => `WHEN ${approachExpr} <= ${km * 1000} THEN ${i}`)
      .join(' ');
    return `CASE ${whens} ELSE ${n - 1} END`;
  }

  // --- Recherche côté expéditeur ------------------------------------------

  // Cercle progressif : renvoie les livreurs au premier rayon non vide, sinon
  // le rayon maximal avec un message honnête. Réservé à l'expéditeur de la
  // livraison, tant que celle-ci est en recherche.
  async getDriversForDelivery(
    deliveryId: string,
    userId: string,
  ): Promise<DriverSearchResult> {
    const delivery = await this.deliveries.getByIdOrFail(deliveryId);
    if (delivery.senderId !== userId) {
      throw new ForbiddenException(
        'Seule la personne qui a commandé cette course peut consulter les livreurs.',
      );
    }
    if (delivery.status !== 'recherche') {
      throw new ConflictException(
        'La recherche de livreur est déjà terminée pour cette livraison.',
      );
    }

    const [longitude, latitude] = delivery.pickupLocation.coordinates;
    const courseM = this.vehicleCaps.distanceMeters(
      delivery.pickupLocation.coordinates,
      delivery.dropoffLocation.coordinates,
    );
    const softCaps = this.vehicleCaps.effectiveApproachCapsM(courseM);

    // Le rayon n'est plus « le plus petit qui contient quelqu'un » mais celui que
    // le temps a ouvert : le client voit littéralement le cercle s'élargir au fil
    // de sa recherche, et ce cercle est exactement celui des livreurs qui peuvent
    // accepter à cet instant (même règle que le feed livreur).
    const radiusKm = this.currentRingKm(delivery);
    const drivers = await this.queryAvailableDrivers(
      longitude,
      latitude,
      radiusKm * 1000,
      this.maxDrivers,
      softCaps,
    );
    await this.deliveries.setSearchRadius(deliveryId, radiusKm);

    if (drivers.length === 0) {
      const isLastRing = radiusKm === this.radiiKm[this.radiiKm.length - 1];
      return {
        radiusKm,
        availableCount: 0,
        drivers: [],
        message: isLastRing
          ? 'Recherche en cours, ça peut prendre un peu plus de temps dans votre zone.'
          : 'Recherche en cours, on élargit petit à petit autour de vous.',
      };
    }

    const count = await this.countAvailable(
      latitude,
      longitude,
      radiusKm * 1000,
      softCaps,
    );
    return {
      radiusKm,
      availableCount: count ?? drivers.length,
      drivers,
      message: null,
    };
  }

  // Offre de mission : à la publication, notifie les livreurs disponibles dans
  // le rayon initial du cercle progressif. « Activer un réseau de personnes
  // disponibles autour de soi » (dossier §4). Best-effort, déclenché sur
  // événement pour éviter tout couplage deliveries → matching.
  async notifyNearbyDrivers(deliveryId: string): Promise<void> {
    const delivery = await this.deliveries.getByIdOrFail(deliveryId);
    if (delivery.status !== 'recherche') {
      return;
    }

    const [longitude, latitude] = delivery.pickupLocation.coordinates;
    const courseM = this.vehicleCaps.distanceMeters(
      delivery.pickupLocation.coordinates,
      delivery.dropoffLocation.coordinates,
    );
    const drivers = await this.queryAvailableDrivers(
      longitude,
      latitude,
      this.radiiKm[0] * 1000,
      this.maxDrivers,
      this.vehicleCaps.effectiveApproachCapsM(courseM),
    );

    await Promise.all(
      drivers.map((driver) =>
        this.notifications.sendToUser(driver.userId, {
          title: 'Nouvelle mission près de vous 🏍️',
          body: `Course de ${delivery.priceFcfa} FCFA. ${delivery.pickupAddress} → ${delivery.dropoffAddress}.`,
          data: { type: 'new_mission', deliveryId: delivery.id },
        }),
      ),
    );
  }

  // Notifie les livreurs d'un palier qui vient de s'ouvrir. Sans cela, seuls les
  // livreurs du palier initial reçoivent un push : ceux des paliers suivants
  // devraient avoir l'app ouverte pour voir la mission arriver dans leur feed.
  //
  // Ne notifie QUE la couronne nouvellement ouverte (entre l'ancien et le nouveau
  // rayon) : les plus proches ont déjà été prévenus à leur propre palier.
  // Idempotent via `notified_ring_index` (UPDATE conditionnel).
  async notifyOpenedRings(): Promise<number> {
    const candidates = await this.deliveries.findSearchingWithRings();
    let notified = 0;

    for (const delivery of candidates) {
      const index = this.currentRingIndex(delivery);
      if (index <= delivery.notifiedRingIndex) continue;

      // Verrou logique : le premier balayage qui passe l'index gagne, les autres
      // (autre instance, balayage concurrent) ne renotifient pas.
      const claimed = await this.deliveries.claimRingNotification(
        delivery.id,
        delivery.notifiedRingIndex,
        index,
      );
      if (!claimed) continue;

      const [longitude, latitude] = delivery.pickupLocation.coordinates;
      const courseM = this.vehicleCaps.distanceMeters(
        delivery.pickupLocation.coordinates,
        delivery.dropoffLocation.coordinates,
      );
      const softCaps = this.vehicleCaps.effectiveApproachCapsM(courseM);
      const drivers = await this.queryAvailableDrivers(
        longitude,
        latitude,
        this.radiiKm[index] * 1000,
        this.maxDrivers,
        softCaps,
      );
      // Couronne : on exclut ceux qui étaient déjà dans le rayon précédent.
      const innerM = this.radiiKm[index - 1] * 1000;
      const fresh = drivers.filter((d) => d.distanceMeters > innerM);
      if (fresh.length === 0) continue;

      await Promise.all(
        fresh.map((driver) =>
          this.notifications.sendToUser(driver.userId, {
            title: 'Mission encore disponible 🏍️',
            body: `Course de ${delivery.priceFcfa} FCFA. ${delivery.pickupAddress} → ${delivery.dropoffAddress}.`,
            data: { type: 'new_mission', deliveryId: delivery.id },
          }),
        ),
      );
      notified += fresh.length;
    }
    return notified;
  }

  // --- Feed côté livreur ---------------------------------------------------

  // Missions ouvertes proches du livreur, triées par distance d'approche.
  async getFeedForDriver(userId: string): Promise<MissionCard[]> {
    const driver = await this.driverProfiles.getByUserIdOrFail(userId);
    if (!driver.currentLocation) {
      throw new BadRequestException(
        'Activez votre position pour voir les missions proches.',
      );
    }

    const [longitude, latitude] = driver.currentLocation.coordinates;
    const maxKm = this.radiiKm[this.radiiKm.length - 1];

    // Modes doux : rayon d'approche plafonné + courses trop longues masquées.
    const approachCapKm = this.vehicleCaps.approachCapKm(driver.vehicleType);
    const effectiveMaxKm =
      approachCapKm !== null ? Math.min(maxKm, approachCapKm) : maxKm;
    const courseCapKm = this.vehicleCaps.courseCapKm(driver.vehicleType);
    // 0 = pas de plafond de course (moto/voiture/camionnette).
    const courseCapM = courseCapKm !== null ? courseCapKm * 1000 : 0;

    // Secondes écoulées depuis que la course est proposable (par livraison).
    const elapsedSql = `EXTRACT(EPOCH FROM (now() - COALESCE(d.scheduled_at, d.created_at)))`;

    // Début de la fenêtre PROPRE à ce livreur : l'instant où SON palier s'est
    // ouvert (index × pas). Sa barre part donc pleine et se vide sur son créneau
    // — ex. 150 s pour un livreur à 10 km sur une fenêtre de 180 s — au lieu
    // d'apparaître déjà entamée. L'échéance, elle, reste globale : il ne gagne
    // pas de temps, il en voit seulement une lecture honnête.
    const windowStartSql = `
        CASE
          WHEN t.expires_at IS NULL THEN NULL
          ELSE t.live_start
             + make_interval(secs => ${this.ringIndexSql('t.approach_m')} * ${this.ringStepSeconds})
        END`;

    const rows = await this.dataSource.query(
      `
      SELECT
        id, pickup_address, dropoff_address, price_fcfa, package_type,
        created_at, expires_at, approach_m, course_m,
        ${windowStartSql} AS window_started_at
      FROM (
        SELECT
          d.id,
          d.pickup_address,
          d.dropoff_address,
          d.price_fcfa,
          d.package_type,
          d.created_at,
          d.expires_at,
          COALESCE(d.scheduled_at, d.created_at) AS live_start,
          ${elapsedSql} AS elapsed_s,
          ST_Distance(
            d.pickup_location,
            ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
          ) AS approach_m,
          ST_Distance(d.pickup_location, d.dropoff_location) AS course_m
        FROM deliveries d
        WHERE d.status = 'recherche'
          AND d.sender_id <> $3
          AND (d.scheduled_at IS NULL OR d.scheduled_at <= now())
          -- Délai de recherche dépassé : la mission sort du feed immédiatement,
          -- sans attendre le passage du job d'expiration.
          AND (d.expires_at IS NULL OR d.expires_at > now())
          -- Borne large (index GIST) : rayon max, déjà plafonné pour les modes doux.
          AND ST_DWithin(
            d.pickup_location,
            ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography,
            $4::float8
          )
          AND (
            $6::float8 = 0
            OR ST_Distance(d.pickup_location, d.dropoff_location) <= $6::float8
          )
      ) t
      -- Cercle progressif : seul le palier ouvert par le temps écoulé est visible.
      WHERE t.approach_m <= ${this.ringRadiusSql('t.elapsed_s')}
      ORDER BY t.approach_m ASC
      LIMIT $5::int
      `,
      [
        longitude,
        latitude,
        driver.userId,
        effectiveMaxKm * 1000,
        this.feedLimit,
        courseCapM,
      ],
    );

    return rows.map(rowToMissionCard);
  }

  // --- Requêtes PostGIS ----------------------------------------------------

  // Livreurs disponibles autour d'un point, triés par priorité (dossier §5) :
  // distance de récupération, puis note, puis historique.
  private async queryAvailableDrivers(
    longitude: number,
    latitude: number,
    radiusMeters: number,
    limit: number,
    softCaps: { velo: number; apied: number },
  ): Promise<DriverCard[]> {
    const rows = await this.dataSource.query(
      `
      SELECT
        dp.id AS driver_id,
        dp.user_id,
        u.full_name,
        u.selfie_url,
        dp.vehicle_type,
        dp.rating_average,
        dp.total_deliveries,
        ST_Distance(
          dp.current_location,
          ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
        ) AS distance_m
      FROM driver_profiles dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.is_available = TRUE
        AND dp.status = 'actif'
        AND u.is_active = TRUE
        AND (dp.suspended_until IS NULL OR dp.suspended_until < now())
        AND dp.current_location IS NOT NULL
        AND ST_DWithin(
          dp.current_location,
          ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography,
          ${softCapDistanceSql('$3', '$5', '$6')}
        )
      ORDER BY distance_m ASC, dp.rating_average DESC, dp.total_deliveries DESC
      LIMIT $4::int
      `,
      [longitude, latitude, radiusMeters, limit, softCaps.velo, softCaps.apied],
    );

    return rows.map(rowToDriverCard);
  }

  // Compteur live : chemin rapide via Redis, repli PostGIS si le cache manque.
  // Le cache Redis ne connaît pas le type de véhicule ; on ne l'utilise donc que
  // lorsqu'aucun plafond doux n'exclut de livreurs pour cette course (velo et
  // apied au plafond nominal). Sinon on passe par PostGIS pour rester exact.
  private async countAvailable(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    softCaps: { velo: number; apied: number },
  ): Promise<number | null> {
    const softCapActive =
      softCaps.velo < radiusMeters || softCaps.apied < radiusMeters;

    if (!softCapActive) {
      const cached = await this.presence.countWithin(
        latitude,
        longitude,
        radiusMeters,
      );
      if (cached !== null) {
        return cached;
      }
    }

    const rows = await this.dataSource.query(
      `
      SELECT COUNT(*)::int AS count
      FROM driver_profiles dp
      WHERE dp.is_available = TRUE
        AND dp.status = 'actif'
        AND (dp.suspended_until IS NULL OR dp.suspended_until < now())
        AND dp.current_location IS NOT NULL
        AND ST_DWithin(
          dp.current_location,
          ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography,
          ${softCapDistanceSql('$3', '$4', '$5')}
        )
      `,
      [longitude, latitude, radiusMeters, softCaps.velo, softCaps.apied],
    );
    return rows.length > 0 ? Number(rows[0].count) : 0;
  }
}
