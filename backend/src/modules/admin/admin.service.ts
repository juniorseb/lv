import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { MessagesService } from '../messaging/messages.service';
import { MessageView } from '../messaging/messages.view';
import { SosService } from '../sos/sos.service';
import { AdminSosView } from '../sos/sos.view';
import { NotificationsService } from '../notifications/notifications.service';
import { DriverDocumentsService } from '../profiles/driver-documents.service';
import { DriverProfilesService } from '../profiles/driver-profiles.service';
import { DriverDocumentStatus } from '../profiles/entities/driver-document.entity';
import { DriverStatus } from '../profiles/entities/driver-profile.entity';
import {
  DriverDocumentView,
  toDriverDocumentView,
} from '../profiles/profile.view';
import { UsersService } from '../users/users.service';
import {
  AdminDriverRow,
  AdminDriverView,
  toAdminDriverView,
} from './admin-driver.view';
import { AdminUserView, toAdminUserView } from './admin-user.view';

const DRIVER_STATUSES: DriverStatus[] = ['en_validation', 'actif', 'suspendu'];

export interface AdminStats {
  users: number;
  drivers: number;
  commerces: number;
  deliveries: {
    total: number;
    recherche: number;
    enCours: number;
    terminee: number;
    annulee: number;
    // Recherche expirée : aucun livreur ne s'est libéré à temps.
    expiree: number;
  };
  pendingVerifications: number;
  pendingDrivers: number;
}

// Back-office : validation des CNI (Niveau 2) et statistiques (dossier §6/§9).
@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly driverProfiles: DriverProfilesService,
    private readonly driverDocuments: DriverDocumentsService,
    private readonly messages: MessagesService,
    private readonly sos: SosService,
    private readonly notifications: NotificationsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Conversation d'une livraison, conservée pour l'admin (litiges/support/
  // sécurité/modération) même après fermeture côté client/livreur.
  getDeliveryMessages(deliveryId: string): Promise<MessageView[]> {
    return this.messages.getForAdmin(deliveryId);
  }

  // Alertes Livrechap Protect actives (support) + résolution.
  listActiveSos(): Promise<AdminSosView[]> {
    return this.sos.listActive();
  }

  resolveSos(alertId: string, adminId: string): Promise<void> {
    return this.sos.resolveByAdmin(alertId, adminId);
  }

  // Revue d'un document livreur (validé / rejeté).
  async setDocumentStatus(
    documentId: string,
    status: DriverDocumentStatus,
  ): Promise<DriverDocumentView> {
    const doc = await this.driverDocuments.setStatus(documentId, status);
    return toDriverDocumentView(doc);
  }

  // --- Validation des livreurs (spec-onboarding-livreur-v2 §4) -------------

  // Livreurs en attente de validation, les plus anciens d'abord.
  listPendingDrivers(): Promise<AdminDriverView[]> {
    return this.queryDrivers("dp.status = 'en_validation'");
  }

  // Tous les livreurs (validation + suivi), en_validation d'abord.
  listAllDrivers(): Promise<AdminDriverView[]> {
    return this.queryDrivers('TRUE');
  }

  private async queryDrivers(
    where: string,
    params: unknown[] = [],
  ): Promise<AdminDriverView[]> {
    const rows: AdminDriverRow[] = await this.dataSource.query(
      `
      SELECT
        dp.id AS driver_id,
        dp.user_id,
        u.full_name,
        u.phone_number,
        dp.vehicle_type,
        dp.status,
        dp.zones,
        dp.mobile_money_operator,
        dp.mobile_money_number,
        dp.mobile_money_holder,
        u.verification_level,
        u.id_document_url,
        u.id_document_type,
        u.selfie_url,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', dd.id,
                'type', dd.type_document,
                'url', dd.url,
                'status', dd.status,
                'dateExpiration', dd.date_expiration
              ) ORDER BY dd.type_document
            )
            FROM driver_documents dd
            WHERE dd.driver_id = dp.id
          ),
          '[]'::json
        ) AS documents,
        (
          SELECT json_build_object(
            'vehicleType', v.vehicle_type,
            'marque', v.marque,
            'modele', v.modele,
            'annee', v.annee,
            'couleur', v.couleur,
            'immatriculation', v.immatriculation,
            'photoAvantUrl', v.photo_avant_url,
            'photoArriereUrl', v.photo_arriere_url,
            'photoPlaqueUrl', v.photo_plaque_url
          )
          FROM vehicles v
          WHERE v.driver_id = dp.id AND v.is_active = TRUE
          LIMIT 1
        ) AS vehicle,
        dp.total_deliveries,
        dp.rating_average,
        dp.created_at
      FROM driver_profiles dp
      JOIN users u ON u.id = dp.user_id
      WHERE ${where}
      ORDER BY
        CASE dp.status WHEN 'en_validation' THEN 0 WHEN 'actif' THEN 1 ELSE 2 END,
        dp.created_at ASC
      `,
      params,
    );
    return rows.map(toAdminDriverView);
  }

  // Décision de l'admin : active ou suspend un livreur, puis le notifie.
  async setDriverStatus(
    driverId: string,
    status: DriverStatus,
  ): Promise<AdminDriverView> {
    if (!DRIVER_STATUSES.includes(status)) {
      throw new BadRequestException('Statut livreur invalide.');
    }

    // Garde-fou : on ne peut activer un livreur que si tous ses documents
    // obligatoires sont validés (spec-onboarding-livreur-v2 §4).
    if (status === 'actif') {
      const current = await this.driverProfiles.findById(driverId);
      if (!current) {
        throw new BadRequestException('Profil livreur introuvable.');
      }
      const missing = await this.driverDocuments.missingValidatedDocuments(
        driverId,
        current.vehicleType,
      );
      if (missing.length > 0) {
        throw new BadRequestException(
          `Documents à valider avant activation : ${missing.join(', ')}.`,
        );
      }
    }

    const profile = await this.driverProfiles.setStatus(driverId, status);

    const message =
      status === 'actif'
        ? {
            title: 'Compte livreur activé ✅',
            body: 'Vous pouvez maintenant passer en mode Disponible et recevoir des missions.',
          }
        : status === 'suspendu'
          ? {
              title: 'Compte livreur suspendu',
              body: 'Votre compte livreur a été suspendu. Contactez le support pour plus d\'informations.',
            }
          : null;
    if (message) {
      await this.notifications.sendToUser(profile.userId, {
        ...message,
        data: { type: 'driver_status', status },
      });
    }

    const [view] = await this.queryDrivers('dp.id = $1', [driverId]);
    return view;
  }

  async listPendingVerifications(): Promise<AdminUserView[]> {
    const users = await this.usersService.listPendingIdVerifications();
    return users.map(toAdminUserView);
  }

  // Validation manuelle : passage au Niveau 2 « Vérifié ».
  async verifyUser(userId: string): Promise<AdminUserView> {
    const user = await this.usersService.setVerificationLevel(userId, 'verifie');
    return toAdminUserView(user);
  }

  // Rejet : la pièce est effacée, le compte reste au Niveau 1.
  async rejectVerification(userId: string): Promise<AdminUserView> {
    const user = await this.usersService.clearIdDocument(userId);
    return toAdminUserView(user);
  }

  async getStats(): Promise<AdminStats> {
    const [users, drivers, commerces, deliveryRows, pending, pendingDrivers] =
      await Promise.all([
        this.count('SELECT COUNT(*)::int AS c FROM users'),
        this.count('SELECT COUNT(*)::int AS c FROM driver_profiles'),
        this.count(
          "SELECT COUNT(*)::int AS c FROM users WHERE account_type = 'commerce'",
        ),
        this.dataSource.query(
          'SELECT status, COUNT(*)::int AS c FROM deliveries GROUP BY status',
        ),
        this.count(
          "SELECT COUNT(*)::int AS c FROM users WHERE id_document_url IS NOT NULL AND verification_level = 'standard'",
        ),
        this.count(
          "SELECT COUNT(*)::int AS c FROM driver_profiles WHERE status = 'en_validation'",
        ),
      ]);

    const byStatus: Record<string, number> = {};
    for (const row of deliveryRows as { status: string; c: number }[]) {
      byStatus[row.status] = Number(row.c);
    }

    return {
      users,
      drivers,
      commerces,
      deliveries: {
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
        recherche: byStatus['recherche'] ?? 0,
        enCours:
          (byStatus['livreur_trouve'] ?? 0) + (byStatus['colis_recupere'] ?? 0),
        terminee: byStatus['terminee'] ?? 0,
        annulee: byStatus['annulee'] ?? 0,
        expiree: byStatus['expiree'] ?? 0,
      },
      pendingVerifications: pending,
      pendingDrivers,
    };
  }

  private async count(sql: string): Promise<number> {
    const rows = await this.dataSource.query(sql);
    return rows.length > 0 ? Number(rows[0].c) : 0;
  }
}
