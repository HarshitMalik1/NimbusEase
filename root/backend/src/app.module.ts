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
      useFactory: (configService: ConfigService) => {
        const mongoUrl = configService.get('MONGO_URL') || 'mongodb://admin:password123@localhost:27018/secure_cloud?authSource=admin';
        console.log(`[DEBUG] Connecting to MongoDB at: ${mongoUrl}`);
        return {
          type: 'mongodb',
          url: mongoUrl,
          autoLoadEntities: true,
          synchronize: process.env.NODE_ENV !== 'production',
          useUnifiedTopology: true,
          useNewUrlParser: true,
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 60000,
      limit: 100, // Increased from 10
    }, {
      name: 'medium',
      ttl: 60000,
      limit: 200, // Increased from 50
    }, {
      name: 'long',
      ttl: 60000,
      limit: 500, // Increased from 100
    }]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    // Feature Modules
    AuthModule,
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