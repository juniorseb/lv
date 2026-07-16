import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MatchingService } from './matching.service';

// Pousse une notification aux livreurs quand un palier du cercle progressif
// s'ouvre (5 km à 1/3 de la fenêtre, 10 km à 2/3). Sans lui, seuls les livreurs
// du palier initial sont poussés : les autres devraient garder l'app ouverte.
//
// Vit dans le module matching (et non deliveries) : deliveries ne peut pas
// dépendre de matching sans créer un cycle.
//
// ⚠️ Mono-instance en pratique : `claimRingNotification` (UPDATE conditionnel)
// protège déjà du double envoi, y compris si plusieurs instances balaient.
@Injectable()
export class RingDispatchJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RingDispatchJob.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly matching: MatchingService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const seconds = Number(this.config.get('MATCHING_RING_SWEEP_SECONDS')) || 10;
    if (seconds <= 0) {
      this.logger.warn('Notifications par palier désactivées.');
      return;
    }
    this.timer = setInterval(() => void this.sweep(), seconds * 1000);
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
      const count = await this.matching.notifyOpenedRings();
      if (count > 0) {
        this.logger.log(`${count} livreur(s) notifié(s) sur un palier ouvert.`);
      }
    } catch (error) {
      // Best-effort : un balayage raté ne doit jamais tuer le process.
      this.logger.warn(`Balayage des paliers échoué: ${error}`);
    }
  }
}
