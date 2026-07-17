import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';

import { PushReceipt } from './entities/push-receipt.entity';
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
    @InjectRepository(PushReceipt)
    private readonly receipts: Repository<PushReceipt>,
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
      await this.purgeTokens(outcome.invalidTokens);
    }

    // « Accepté » ne veut pas dire « livré » : on garde les tickets pour aller
    // chercher le verdict réel plus tard (voir PushReceiptJob).
    if (outcome.tickets.length > 0) {
      await this.receipts.save(
        outcome.tickets.map((t) =>
          this.receipts.create({ ticketId: t.ticketId, token: t.token }),
        ),
      );
    }
  }

  // --- Reçus ---------------------------------------------------------------

  // Réclame le verdict des tickets assez vieux pour qu'Expo l'ait rendu.
  // Appelé périodiquement par PushReceiptJob.
  async collectReceipts(olderThanSeconds: number, limit = 500): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
    const pending = await this.receipts.find({
      where: { createdAt: LessThanOrEqual(cutoff) },
      take: limit,
    });
    if (pending.length === 0) {
      return 0;
    }

    const verdicts = await this.expoPush.fetchReceipts(
      pending.map((p) => ({ ticketId: p.ticketId, token: p.token })),
    );

    if (verdicts.invalidTokens.length > 0) {
      await this.purgeTokens(verdicts.invalidTokens);
    }
    // Verdict rendu = ticket clos. Ceux qu'Expo n'a pas encore tranchés restent
    // en base et seront réclamés au prochain passage.
    if (verdicts.settled.length > 0) {
      await this.receipts.delete({ ticketId: In(verdicts.settled) });
    }
    return verdicts.settled.length;
  }

  private async purgeTokens(tokens: string[]): Promise<void> {
    await this.deviceTokens.delete({ token: In(tokens) });
    this.logger.log(`${tokens.length} jeton(s) périmé(s) supprimé(s).`);
  }
}
