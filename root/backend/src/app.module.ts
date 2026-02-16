import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';

// Feature Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StorageModule } from './storage/storage.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { AlertsModule } from './alerts/alerts.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { AiSecurityGuard } from './ai-engine/ai-security.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'root/backend/.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mongodb',
        url: configService.get('MONGO_URL') || 'mongodb://localhost:27017/secure_cloud',
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production', // ⚠️ Disable in production
        useUnifiedTopology: true,
        useNewUrlParser: true,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 60000,
      limit: 10,
    }, {
      name: 'medium',
      ttl: 60000,
      limit: 50,
    }, {
      name: 'long',
      ttl: 60000,
      limit: 100,
    }]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    // Feature Modules
    UsersModule,
    StorageModule,
    BlockchainModule,
    MonitoringModule,
    AiEngineModule,
    AlertsModule,
    AuditModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AiSecurityGuard,
    },
  ],
})
export class AppModule {}