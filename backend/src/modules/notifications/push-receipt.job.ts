import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { NotificationsService } from './notifications.service';

// Va chercher chez Expo le verdict des push envoyés.
//
// Expo ne dit à l'envoi que « accepté » ; le sort réel (livré, appareil disparu,
// clé FCM invalide) n'est disponible qu'après un délai. Sans ce job, un push
// perdu l'est en silence — et une erreur de configuration ferait échouer tous
// les push Android sans qu'aucune trace n'apparaisse.
//
// Comme les autres jobs du projet : setInterval, pas @nestjs/schedule.
@Injectable()
export class PushReceiptJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushReceiptJob.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly delaySeconds: number;

  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {
    // Expo demande de laisser passer un moment avant de réclamer un reçu :
    // trop tôt, il n'a pas encore de réponse et le ticket resterait en attente.
    this.delaySeconds =
      Number(this.config.get('PUSH_RECEIPT_DELAY_SECONDS')) || 900;
  }

  onModuleInit(): void {
    const sweep = Number(this.config.get('PUSH_RECEIPT_SWEEP_SECONDS')) || 300;
    // Inutile de balayer si aucun push ne part.
    const mode = (this.config.get<string>('PUSH_MODE') ?? 'console').toLowerCase();
    if (mode !== 'live' || sweep <= 0) {
      return;
    }
    this.timer = setInterval(() => void this.sweep(), sweep * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async sweep(): Promise<void> {
    try {
      const settled = await this.notifications.collectReceipts(
        this.delaySeconds,
      );
      if (settled > 0) {
        this.logger.log(`${settled} reçu(s) de push traité(s).`);
      }
    } catch (error) {
      this.logger.warn(`Collecte des reçus échouée : ${error}`);
    }
  }
}
