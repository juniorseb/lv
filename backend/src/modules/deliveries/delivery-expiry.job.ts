import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DeliveriesService } from './deliveries.service';

// Balayage périodique des recherches dépassées (→ `expiree` + notif client).
//
// Volontairement sans @nestjs/schedule : un seul job, un setInterval suffit et
// évite une dépendance. `unref()` pour ne jamais retenir le process en vie.
//
// ⚠️ Mono-instance : si le backend est répliqué, chaque instance balaiera. C'est
// sans danger (l'UPDATE est idempotent et conditionnel), mais la notification
// pourrait partir en double — à verrouiller (advisory lock) le jour du scale-out.
@Injectable()
export class DeliveryExpiryJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryExpiryJob.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly deliveries: DeliveriesService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const seconds =
      Number(this.config.get('DELIVERY_EXPIRY_SWEEP_SECONDS')) || 30;
    if (seconds <= 0) {
      this.logger.warn('Balayage des expirations désactivé.');
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
      const count = await this.deliveries.expireOverdueSearches();
      if (count > 0) {
        this.logger.log(`${count} recherche(s) expirée(s).`);
      }
    } catch (error) {
      // Best-effort : un échec de balayage ne doit jamais tuer le process.
      this.logger.warn(`Balayage des expirations échoué: ${error}`);
    }
  }
}
