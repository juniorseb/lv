import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SmsService } from '../auth/sms.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { TriggerSosDto } from './dto/sos.dto';
import { SosAlert } from './entities/sos-alert.entity';
import {
  AdminSosView,
  SosAlertView,
  toSosAlertView,
} from './sos.view';

// Livrechap Protect : alertes de sécurité pendant une livraison. Déclenchement
// (appui long 3 s côté app) → position partagée en temps réel + support alerté +
// contact d'urgence prévenu par SMS. Résolution par l'utilisateur ou un admin.
@Injectable()
export class SosService {
  private readonly logger = new Logger(SosService.name);

  constructor(
    @InjectRepository(SosAlert)
    private readonly alerts: Repository<SosAlert>,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly sms: SmsService,
  ) {}

  async trigger(userId: string, dto: TriggerSosDto): Promise<SosAlertView> {
    // Idempotent : une seule alerte active par utilisateur. Un nouvel appui met
    // simplement à jour la position.
    const existing = await this.alerts.findOne({
      where: { userId, status: 'active' },
    });
    if (existing) {
      existing.lastLatitude = dto.latitude;
      existing.lastLongitude = dto.longitude;
      existing.locationUpdatedAt = new Date();
      return toSosAlertView(await this.alerts.save(existing));
    }

    const alert = await this.alerts.save(
      this.alerts.create({
        userId,
        role: dto.role,
        deliveryId: dto.deliveryId ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        lastLatitude: dto.latitude,
        lastLongitude: dto.longitude,
        locationUpdatedAt: new Date(),
        status: 'active',
      }),
    );

    await this.notifySupportAndContact(userId, alert);
    return toSosAlertView(alert);
  }

  async updateLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const alert = await this.alerts.findOne({
      where: { userId, status: 'active' },
    });
    if (!alert) return;
    alert.lastLatitude = latitude;
    alert.lastLongitude = longitude;
    alert.locationUpdatedAt = new Date();
    await this.alerts.save(alert);
  }

  // « Je suis en sécurité » : l'utilisateur clôt sa propre alerte.
  async resolveByUser(userId: string): Promise<void> {
    const alert = await this.alerts.findOne({
      where: { userId, status: 'active' },
    });
    if (!alert) return;
    alert.status = 'resolved';
    alert.resolvedBy = userId;
    alert.resolvedAt = new Date();
    await this.alerts.save(alert);
  }

  async getMyActive(userId: string): Promise<SosAlertView | null> {
    const alert = await this.alerts.findOne({
      where: { userId, status: 'active' },
    });
    return alert ? toSosAlertView(alert) : null;
  }

  // --- Admin (support) -----------------------------------------------------

  async listActive(): Promise<AdminSosView[]> {
    const alerts = await this.alerts.find({
      where: { status: 'active' },
      order: { createdAt: 'DESC' },
    });
    const views: AdminSosView[] = [];
    for (const a of alerts) {
      const user = await this.users.findById(a.userId);
      views.push({
        id: a.id,
        status: a.status,
        role: a.role,
        userName: user?.fullName ?? null,
        userPhone: user?.phoneNumber ?? '',
        deliveryId: a.deliveryId,
        latitude: a.lastLatitude ?? a.latitude,
        longitude: a.lastLongitude ?? a.longitude,
        locationUpdatedAt: a.locationUpdatedAt,
        createdAt: a.createdAt,
      });
    }
    return views;
  }

  async resolveByAdmin(alertId: string, adminId: string): Promise<void> {
    const alert = await this.alerts.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundException('Alerte introuvable.');
    }
    alert.status = 'resolved';
    alert.resolvedBy = adminId;
    alert.resolvedAt = new Date();
    await this.alerts.save(alert);
  }

  // --- Interne -------------------------------------------------------------

  private async notifySupportAndContact(
    userId: string,
    alert: SosAlert,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    const name = user?.fullName?.trim() || 'Un utilisateur';
    const roleLabel = alert.role === 'livreur' ? 'livreur' : 'client';
    const mapUrl = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;

    // Support (admins) — notification push, best-effort.
    try {
      const admins = await this.users.listAdmins();
      await Promise.all(
        admins.map((a) =>
          this.notifications.sendToUser(a.id, {
            title: '🚨 Alerte Livrechap Protect',
            body: `${name} (${roleLabel}) a déclenché une alerte. Position partagée en temps réel.`,
            data: { type: 'sos', alertId: alert.id },
          }),
        ),
      );
    } catch (e) {
      this.logger.error(`Notif support SOS échouée: ${e}`);
    }

    // Contact d'urgence — SMS, best-effort.
    if (user?.emergencyContactPhone) {
      try {
        await this.sms.sendMessage(
          user.emergencyContactPhone,
          `Alerte securite Livrechap : ${name} a declenche une alerte pendant une livraison. Derniere position : ${mapUrl}`,
        );
      } catch (e) {
        this.logger.error(`SMS contact d'urgence SOS échoué: ${e}`);
      }
    }
  }
}
