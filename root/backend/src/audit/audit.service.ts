import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLog, AuditSeverity } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
    private eventEmitter: EventEmitter2,
  ) {}

  async logAction(userId: string, action: string, metadata: any = {}, severity: AuditSeverity = 'INFO') {
    const log = this.auditRepository.create({
      userId,
      action,
      metadata,
      severity,
      createdAt: new Date(),
    });

    const savedLog = await this.auditRepository.save(log);
    
    // 📢 Notify AI Engine and other subscribers
    this.eventEmitter.emit('audit.log.created', savedLog);

    return savedLog;
  }

  async getUserLogs(userId: string, limit = 100) {
    return this.auditRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRecentLogs(limit = 100) {
    return this.auditRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
