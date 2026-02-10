import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';

import { MonitoringService } from './monitoring.service';
import { MonitoringGateway } from './websocket.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    // Needed for @OnEvent decorators
    EventEmitterModule.forRoot(),

    // Needed for JWT verification in WebSocketGateway
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  providers: [
    MonitoringService,
    MonitoringGateway,
  ],
  exports: [
    MonitoringService,
  ],
})
export class MonitoringModule {}
