import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MonitoringService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Emit anomaly detected by AI engine
   */
  emitSecurityAnomaly(data: {
    userId: string;
    score: number;
    analysis: {
      summary: string;
      recommendations: string[];
    };
  }) {
    this.eventEmitter.emit('security.anomaly', data);
  }

  /**
   * Emit generic security alert
   */
  emitSecurityAlert(data: {
    type: string;
    userId: string;
    fileId?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }) {
    this.eventEmitter.emit('security.alert', data);
  }

  /**
   * Emit file upload event
   */
  emitFileUploaded(data: {
    userId: string;
    fileId: string;
    fileName: string;
  }) {
    this.eventEmitter.emit('file.uploaded', data);
  }

  /**
   * Emit blockchain verification result
   */
  emitBlockchainVerified(data: {
    userId: string;
    fileId: string;
    valid: boolean;
    txHash: string;
  }) {
    this.eventEmitter.emit('blockchain.verified', data);
  }

  /**
   * Emit system-wide statistics
   */
  emitSystemStats(stats: {
    activeUsers: number;
    anomaliesDetected: number;
    filesStored: number;
    blockchainRecords: number;
  }) {
    this.eventEmitter.emit('system.stats', stats);
  }
}
