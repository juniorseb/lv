import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from './common/redis/redis.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { MatchingModule } from './modules/matching/matching.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { SosModule } from './modules/sos/sos.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'livrechap',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production', // désactiver en production, utiliser des migrations
    }),
    RedisModule,
    AuthModule,
    AdminModule,
    AddressesModule,
    UsersModule,
    ProfilesModule,
    DeliveriesModule,
    LogisticsModule,
    MessagingModule,
    GeocodingModule,
    MatchingModule,
    DriversModule,
    WalletModule,
    PaymentsModule,
    NotificationsModule,
    RatingsModule,
    SosModule,
    StorageModule,
  ],
})
export class AppModule {}
