import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  DevicePlatform,
  DeviceToken,
} from './entities/device-token.entity';

export interface NotificationPayload {
  title: string;
  body: string;
  // Données structurées transmises à l'app (ex: { type, deliveryId }) pour la
  // navigation au tap.
  data?: Record<string, string>;
}

// Notifications push (Firebase Cloud Messaging — dossier §10).
//
// FCM_MODE :
//  - "console" (défaut, dev) : les push sont journalisés, aucun envoi réel.
//  - "live" : envoi via firebase-admin (intégration à brancher).
//
// Toutes les émissions sont best-effort : une notification ne doit jamais faire
// échouer l'action métier qui la déclenche.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly mode: string;

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokens: Repository<DeviceToken>,
    private readonly config: ConfigService,
  ) {
    this.mode = (this.config.get<string>('FCM_MODE') ?? 'console').toLowerCase();
  }

  // --- Gestion des appareils ----------------------------------------------

  // Enregistre (ou réattribue) un jeton d'appareil pour l'utilisateur courant.
  async registerDevice(
    userId: string,
    token: string,
    platform: DevicePlatform = 'android',
  ): Promise<void> {
    const existing = await this.deviceTokens.findOne({ where: { token } });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      await this.deviceTokens.save(existing);
      return;
    }
    await this.deviceTokens.save(
      this.deviceTokens.create({ userId, token, platform }),
    );
  }

  async unregisterDevice(userId: string, token: string): Promise<void> {
    await this.deviceTokens.delete({ userId, token });
  }

  // --- Envoi ---------------------------------------------------------------

  // Envoie une notification à tous les appareils d'un utilisateur. Silencieux
  // s'il n'a aucun appareil enregistré.
  async sendToUser(userId: string, payload: NotificationPayload): Promise<void> {
    try {
      const devices = await this.deviceTokens.find({ where: { userId } });
      if (devices.length === 0) {
        return;
      }
      await this.dispatch(
        devices.map((d) => d.token),
        payload,
      );
    } catch (error) {
      this.logger.warn(`Envoi de notification échoué (user ${userId}): ${error}`);
    }
  }

  private async dispatch(
    tokens: string[],
    payload: NotificationPayload,
  ): Promise<void> {
    if (this.mode === 'live') {
      // TODO(V1) : envoyer via firebase-admin
      // (messaging().sendEachForMulticast({ tokens, notification, data })).
      this.logger.warn(
        `Mode FCM "live" non branché — ${tokens.length} push non envoyé(s) : ${payload.title}`,
      );
      return;
    }

    // Mode console : trace lisible pour le développement.
    this.logger.log(
      `[FCM console] → ${tokens.length} appareil(s) | ${payload.title} — ${payload.body}`,
    );
  }
}
