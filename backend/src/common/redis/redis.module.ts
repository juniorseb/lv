import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';

// Module Redis global : client ioredis unique, réutilisé par tous les modules
// (OTP, cache des positions livreurs, files de matching — cf. dossier §10).
// Exposé globalement pour éviter de le réimporter dans chaque module métier.

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        return new Redis(url, {
          // ioredis retente la connexion en arrière-plan : le boot ne plante pas
          // si Redis n'est pas encore prêt.
          maxRetriesPerRequest: 3,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit();
  }
}
