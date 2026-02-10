import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AlertsService {
  constructor(private eventEmitter: EventEmitter2) {}

  /**
   * Send alert to a user
   */
  sendUserAlert(userId: string, alert: any) {
    this.eventEmitter.emit('security.alert', { userId, ...alert });
  }

  /**
   * Broadcast a system-wide alert
   */
  broadcastAlert(alert: any) {
    this.eventEmitter.emit('system.alert', alert);
  }

  /**
   * Trigger anomaly alert
   */
  triggerAnomalyAlert(userId: string, score: number, analysis: any) {
    this.eventEmitter.emit('security.anomaly', { userId, score, analysis });
  }
}
