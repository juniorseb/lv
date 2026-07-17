import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ExpoPushClient } from './expo-push.client';

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

// Notifications push (dossier §10), émises via le service Expo — voir
// expo-push.client.ts pour le choix Expo plutôt que Firebase en direct.
//
// PUSH_MODE :
//  - "console" (défaut, dev) : les push sont journalisés, aucun envoi réel.
//  - "live" : envoi réel via Expo (exp.host).
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
    private readonly expoPush: ExpoPushClient,
  ) {
    // PUSH_MODE (ex-FCM_MODE : l'envoi passe par Expo, pas par Firebase).
    this.mode = (this.config.get<string>('PUSH_MODE') ?? 'console').toLowerCase();
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
    if (this.mode !== 'live') {
      // Mode console : trace lisible pour le développement.
      this.logger.log(
        `[Push console] → ${tokens.length} appareil(s) | ${payload.title} — ${payload.body}`,
      );
      return;
    }

    // Un jeton natif (FCM/APNs) n'est pas adressable par Expo. Plutôt que de
    // laisser Expo répondre en erreur pour chacun, on les écarte et on le dit :
    // c'est le symptôme d'un mobile resté sur getDevicePushTokenAsync.
    const expoTokens = tokens.filter((t) => ExpoPushClient.isExpoToken(t));
    const foreign = tokens.length - expoTokens.length;
    if (foreign > 0) {
      this.logger.warn(
        `${foreign} jeton(s) hors format Expo ignoré(s) — le mobile doit utiliser getExpoPushTokenAsync.`,
      );
    }
    if (expoTokens.length === 0) {
      return;
    }

    const outcome = await this.expoPush.send(
      expoTokens.map((to) => ({
        to,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: 'default' as const,
        // Une mission proche ou une alerte SOS n'a aucune valeur si elle arrive
        // en différé : Android doit réveiller l'appareil.
        priority: 'high' as const,
      })),
    );

    // Purge des appareils devenus injoignables (app désinstallée/réinstallée).
    if (outcome.invalidTokens.length > 0) {
      await this.deviceTokens.delete({ token: In(outcome.invalidTokens) });
      this.logger.log(
        `${outcome.invalidTokens.length} jeton(s) périmé(s) supprimé(s).`,
      );
    }
  }
}
