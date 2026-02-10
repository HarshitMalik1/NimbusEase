import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AlertsService } from './alerts.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
