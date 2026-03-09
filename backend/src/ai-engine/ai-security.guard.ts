import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecurityAgentService } from './security-agent.service';
import { AiEngineService } from './ai-engine.service';
import { RedisMockService } from './redis-mock.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AiSecurityGuard implements CanActivate {
  private readonly logger = new Logger(AiSecurityGuard.name);

  constructor(
    private reflector: Reflector,
    private securityAgent: SecurityAgentService,
    private aiEngine: AiEngineService,
    private redis: RedisMockService,
    private audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, body, user, file } = request;
    const userId = user?.id || 'anonymous';
    const clientIp = ip || request.connection.remoteAddress;

    // 1. 🛑 FAST BLOCK CHECK (Circuit Breaker)
    // For anonymous users, we MUST block by IP.
    const blockId = userId === 'anonymous' ? clientIp : userId;
    if (this.securityAgent.isBlocked(clientIp, blockId)) {
      this.logger.warn(`🚫 BLOCKED ACCESS ATTEMPT from ${clientIp} (Target: ${blockId})`);
      throw new ForbiddenException('Your access has been restricted by the Security AI.');
    }

    // 2. 🛡️ FILE UPLOAD SCANNING (Python Master Scanner Ensemble)
    if (file && file.path) {
      this.logger.log(`📥 Upload detected. Scanning file: ${file.filename}`);
      const fileVerdict = await this.aiEngine.predictFile(file.path);
      
      if (fileVerdict.status === 'MALICIOUS') {
        this.logger.error(`🚨 MALICIOUS FILE DETECTED by ${fileVerdict.engine}`);
        
        // Log the threat for the Admin Dashboard
        await this.audit.logAction(userId, 'MALICIOUS_FILE_UPLOAD', {
          fileName: file.originalname,
          engine: fileVerdict.engine,
          malwareType: fileVerdict.verdict,
          ip: clientIp,
        }, 'ERROR');

        await this.securityAgent.executeMitigation('FREEZE_STORAGE', userId);
        throw new ForbiddenException(`Security Alert: Malicious file detected (${fileVerdict.engine}).`);
      }
    }

    // 3. 📝 PREPARE NETWORK LOG DATA
    const logData = {
      action: method,
      resource: url,
      details: JSON.stringify(body || {}),
      statusCode: 200, 
      ip: clientIp,
      user: userId,
      timestamp: new Date().toISOString(),
      entropy: this.calculateEntropy(JSON.stringify(body || {})),
      metadata: {
        // Simulated network packet data (57 features for CIC-IDS)
        flowDuration: Math.random() * 5000, 
        totalFwdPackets: method === 'GET' ? Math.floor(Math.random() * 10) : 50,
        idleMin: Math.random() * 100
      }
    };

    // 4. ⏱️ TEMPORAL BEHAVIORAL ANALYSIS (Redis Memory)
    // Note: RedisMockService's lpush expects a string, and its lrange returns parsed objects.
    await this.redis.lpush(`history:${userId}`, JSON.stringify(logData));
    await this.redis.ltrim(`history:${userId}`, 0, 49); // Keep last 50 events

    const userHistory = await this.redis.lrange(`history:${userId}`, 0, -1);
    const behaviorVerdict = await this.securityAgent.analyzeBehaviorSequence(userId, userHistory);
    
    if (behaviorVerdict.is_attack) {
        this.logger.error(`🚨 BEHAVIOR THREAT: ${behaviorVerdict.attack_type} detected over time!`);
        
        // Log for Admin Dashboard
        await this.audit.logAction(userId, 'BEHAVIOR_THREAT_DETECTED', {
          attackType: behaviorVerdict.attack_type,
          confidence: behaviorVerdict.confidence,
          ip: clientIp,
          historyCount: userHistory.length
        }, 'ERROR');

        await this.securityAgent.executeMitigation(behaviorVerdict.mitigation_action, userId);
        throw new ForbiddenException(`Security Alert: ${behaviorVerdict.attack_type} detected in recent activity.`);
    }

    // 5. 🧠 SINGLE-EVENT AI PREDICTION (TFJS 57-Feature Network Model)
    const aiVerdict = await this.aiEngine.predictNetwork(logData);

    if (aiVerdict.isAnomaly) {
      this.logger.warn(`⚠️ Network Anomaly Detected (Confidence: ${aiVerdict.confidence.toFixed(2)})`);

      const threatAnalysis = await this.securityAgent.analyzeThreat(logData);

      if (threatAnalysis.is_attack && threatAnalysis.mitigation_action !== 'NONE') {
        this.logger.error(`🚨 ACTIVE THREAT DETECTED: ${threatAnalysis.attack_type}`);
        
        // Log for Admin Dashboard
        await this.audit.logAction(userId, 'ACTIVE_THREAT_DETECTED', {
          attackType: threatAnalysis.attack_type,
          aiConfidence: aiVerdict.confidence,
          mitigation: threatAnalysis.mitigation_action,
          resource: url,
          ip: clientIp
        }, 'ERROR');

        // Execute Mitigation (Block IP, Revoke, etc.)
        await this.securityAgent.executeMitigation(threatAnalysis.mitigation_action, threatAnalysis.target || clientIp);
        
        throw new ForbiddenException(`Security Alert: ${threatAnalysis.attack_type} detected.`);
      }
    }

    return true;
  }

  private calculateEntropy(text: string): number {
    if (!text) return 0;
    const charCounts: Record<string, number> = {};
    for (const char of text) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }
    const probs = (Object.values(charCounts) as number[]).map((count: number) => count / text.length);
    return -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
  }
}