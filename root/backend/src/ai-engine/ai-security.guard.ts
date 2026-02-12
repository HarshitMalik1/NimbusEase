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

@Injectable()
export class AiSecurityGuard implements CanActivate {
  private readonly logger = new Logger(AiSecurityGuard.name);

  constructor(
    private reflector: Reflector,
    private securityAgent: SecurityAgentService,
    private aiEngine: AiEngineService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, body, user } = request;
    const userId = user?.id || 'anonymous';
    const clientIp = ip || request.connection.remoteAddress;

    // 1. 🛑 Fast Block Check (Circuit Breaker / Blacklist)
    if (this.securityAgent.isBlocked(clientIp, userId)) {
      this.logger.warn(`🚫 BLOCKED ACCESS ATTEMPT from ${clientIp} (User: ${userId})`);
      throw new ForbiddenException('Your access has been restricted by the Security AI.');
    }

    // 2. 🧠 AI Anomaly Detection
    // Extract features for the AI
    const logData = {
      action: method,
      resource: url,
      details: JSON.stringify(body || {}),
      statusCode: 200, // Predicted/Current
      ip: clientIp,
      user: userId,
      entropy: this.calculateEntropy(JSON.stringify(body || {})),
    };

    // Fast TensorFlow Prediction
    const aiVerdict = await this.aiEngine.predict(logData);

    if (aiVerdict.isAnomaly) {
      this.logger.warn(`⚠️ Anomaly Detected by TensorFlow (Confidence: ${aiVerdict.confidence.toFixed(2)})`);

      // Deep Analysis (DeepSeek / Heuristic)
      const threatAnalysis = await this.securityAgent.analyzeThreat(logData);

      if (threatAnalysis.is_attack && threatAnalysis.mitigation_action !== 'NONE') {
        this.logger.error(`🚨 ACTIVE THREAT DETECTED: ${threatAnalysis.attack_type}`);
        
        // Execute Mitigation (Block IP, etc.)
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
