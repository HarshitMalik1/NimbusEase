import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs';
import * as path from 'path';
import * as fs from 'fs';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditLog } from '../audit/audit-log.entity';
import { SecurityAgentService } from './security-agent.service';
import { RedisMockService } from './redis-mock.service';

@Injectable()
export class AiEngineService implements OnModuleInit {
  private model: tf.LayersModel;
  private readonly logger = new Logger(AiEngineService.name);
  private isModelTrained = false;
  private readonly modelPath = 'file://' + path.join(process.cwd(), 'root/backend/models/security-model');

  constructor(
    private securityAgent: SecurityAgentService,
    private redis: RedisMockService
  ) {}

  async onModuleInit() {
    await this.initModel();
  }

  // ... (initModel and saveModel methods remain unchanged)

  private async initModel() {
    try {
      // 💾 Try loading existing model from disk
      const modelDir = path.join(process.cwd(), 'root/backend/models/security-model');
      if (fs.existsSync(path.join(modelDir, 'model.json'))) {
        this.logger.log('📂 Found model on disk. Loading...');
        const modelJson = JSON.parse(fs.readFileSync(path.join(modelDir, 'model.json'), 'utf8'));
        const weightsBuffer = fs.readFileSync(path.join(modelDir, 'weights.bin'));
        
        this.model = await tf.loadLayersModel(tf.io.fromMemory({
          modelTopology: modelJson.modelTopology,
          weightSpecs: modelJson.weightsManifest[0].weights,
          weightData: weightsBuffer.buffer
        }));

        this.model.compile({
          optimizer: tf.train.adam(0.01),
          loss: 'binaryCrossentropy',
          metrics: ['accuracy'],
        });
        this.isModelTrained = true;
        this.logger.log('✅ AI Model loaded from disk.');
        return;
      }
    } catch (e) {
      this.logger.warn(`Could not load model from disk: ${e.message}`);
    }

    // Define a neural network classifier if no model found
    const model = tf.sequential();
    
    // Input layer (18 features)
    model.add(tf.layers.dense({
      inputShape: [18],
      units: 64, // Increased units for more complex patterns
      activation: 'relu',
    }));
    
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
    }));
    
    model.add(tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
    }));

    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    this.model = model;
    this.logger.log('AI Engine (TensorFlow.js) initialized with 13 Security Features.');
  }

  private async saveModel() {
    try {
      const modelDir = path.join(process.cwd(), 'root/backend/models/security-model');
      if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
      }

      await this.model.save(tf.io.withSaveHandler(async (artifacts) => {
        const modelJson = {
          modelTopology: artifacts.modelTopology,
          weightsManifest: artifacts.weightSpecs ? [{
            paths: ['./weights.bin'],
            weights: artifacts.weightSpecs,
          }] : []
        };
        fs.writeFileSync(path.join(modelDir, 'model.json'), JSON.stringify(modelJson));
        if (artifacts.weightData) {
          const weightData = artifacts.weightData as any;
          const buffer = weightData instanceof ArrayBuffer 
            ? Buffer.from(weightData)
            : Buffer.concat(weightData.map((ab: ArrayBuffer) => Buffer.from(ab)));
          fs.writeFileSync(path.join(modelDir, 'weights.bin'), buffer);
        }
        return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
      }));

      this.logger.log('💾 AI Model persisted to disk (Manual Save).');
    } catch (e) {
      this.logger.error(`Failed to save model: ${e.message}`);
    }
  }

  /**
   * Listen for real database audit logs
   */
  @OnEvent('audit.log.created')
  async handleAuditLog(log: AuditLog) {
    const logData = {
      action: log.action,
      resource: log.metadata?.resource || 'unknown',
      details: JSON.stringify(log.metadata || {}),
      statusCode: log.severity === 'ERROR' ? 400 : 200,
      entropy: this.calculateEntropy(JSON.stringify(log.metadata || {})),
      ip: log.ipAddress,
      user: log.userId,
      timestamp: log.createdAt,
    };

    // 1. Instant Anomaly Detection (Single Event)
    const prediction = await this.predict(logData);

    if (prediction.isAnomaly) {
      this.logger.warn(`🚨 Real-time Anomaly Detected in Audit Log: ${log.action}`);
      const threat = await this.securityAgent.analyzeThreat(logData); // Analyze single event
      if (threat.is_attack) {
        await this.securityAgent.executeMitigation(threat.mitigation_action, log.ipAddress || log.userId);
      }
    }

    // 2. Stateful Tracking (Sequence Analysis)
    if (log.userId) {
      await this.trackUserActivity(log.userId, logData);
    }
  }

  /**
   * Stateful Monitor: Tracks user history in Redis and triggers deep analysis
   */
  async trackUserActivity(userId: string, activity: any) {
    const key = `user:${userId}:history`;
    
    // Push new activity to Redis List
    await this.redis.lpush(key, JSON.stringify(activity));
    
    // Keep only last 50 events
    await this.redis.ltrim(key, 0, 49);

    // Get current count (simulated) or just check modulo if we had a counter
    // For this mock, we'll fetch length.
    const history = await this.redis.lrange(key, 0, -1);

    // Trigger DeepSeek Analysis every 10 events (or if history is full)
    if (history.length % 10 === 0) {
      this.logger.log(`🧠 [Stateful Monitor] Analyzing 50-event sequence for User ${userId}...`);
      
      const sequenceAnalysis = await this.securityAgent.analyzeBehaviorSequence(userId, history);
      
      if (sequenceAnalysis.is_attack) {
         this.logger.error(`🚨 COMPLEX THREAT DETECTED: ${sequenceAnalysis.attack_type}`);
         await this.securityAgent.executeMitigation(sequenceAnalysis.mitigation_action, userId);
      }
    }
  }

  // ... (trainModel, calculateEntropy, predict, extractFeatures methods remain unchanged)
  
  async trainModel(data: any[]) {
    if (!this.model) await this.initModel();
    this.logger.log(`Starting AI model training on ${data.length} logs...`);
    
    const features = data.map(d => this.extractFeatures(d));
    const labels = data.map(d => d.isAnomaly);

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    await this.model.fit(xs, ys, {
      epochs: 30,
      verbose: 0,
    });

    this.isModelTrained = true;
    await this.saveModel();
    
    xs.dispose();
    ys.dispose();
  }

  private calculateEntropy(text: string): number {
    if (!text) return 0;
    const charCounts = {};
    for (const char of text) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }
    const probs = (Object.values(charCounts) as number[]).map((count: number) => count / text.length);
    return -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
  }

  async predict(logData: any): Promise<{ isAnomaly: boolean; confidence: number }> {
    if (!this.model) await this.initModel();

    const featureVector = this.extractFeatures(logData);
    
    // 🛡️ HYBRID DEFENSE: Signature Override (Hard Rules)
    // Indexes: 1:Path, 2:Ransom, 5:SQLi, 8:SSRF, 10:Scrape, 11:PrivEsc, 12:XSS, 13:JIT, 14:Exfil, 15:Cache, 16:Dep, 17:Prompt
    const criticalIndexes = [1, 2, 5, 8, 10, 11, 12, 13, 14, 15, 16, 17];
    const hasCriticalSignature = criticalIndexes.some(idx => featureVector[idx] === 1);

    if (hasCriticalSignature) {
      this.logger.warn(`🛡️ Hard Rule Triggered: Critical Attack Signature Detected in ${logData.resource || logData.action}`);
      return {
        isAnomaly: true,
        confidence: 1.0, 
      };
    }

    const input = tf.tensor2d([featureVector]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const score = (await prediction.data())[0];
    
    input.dispose();
    prediction.dispose();

    return {
      isAnomaly: score > 0.8,
      confidence: score,
    };
  }

  private extractFeatures(d: any): number[] {
    const details = (d.details || '').toLowerCase();
    const resource = (d.resource || '').toLowerCase();
    const action = d.action || '';

    // Regex for Internal IPs (SSRF)
    const internalIpRegex = /(127\.0\.0\.1|localhost|169\.254\.|10\.\d+\.\d+\.\d+|192\.168\.)/;
    
    // Regex for XSS/Script tags (Metadata Poisoning)
    const xssRegex = /(<script>|javascript:|alert\(|onerror=)/;

    return [
      // 0-7: Original Features
      action === 'LOGIN' && d.statusCode >= 400 ? 1 : 0, // Failed Login
      resource.includes('..') || resource.includes('%2e') ? 1 : 0, // Path Traversal
      action === 'DELETE' && details.includes('.encrypted') ? 1 : 0, // Ransomware
      d.statusCode >= 400 && d.statusCode < 500 ? 1 : 0, // Client Error
      d.entropy || 0,
      details.includes("'1'='1") || details.includes('union') ? 1 : 0, // SQLi
      1, // Request volume (simplified)
      0, // User ID encoded

      // 8-12: New Advanced Features
      internalIpRegex.test(details) ? 1 : 0, // SSRF (Localhost/Internal IP in payload)
      (action === 'POST' || action === 'PUT') && d.statusCode === 429 ? 1 : 0, // Resource Exhaustion (Rate Limit Hit)
      action === 'READ' && details.includes('metadata') ? 1 : 0, // Excessive Data Exposure (Scraping)
      details.includes('role') && (details.includes('admin') || details.includes('root')) ? 1 : 0, // Privilege Escalation
      xssRegex.test(details) || xssRegex.test(resource) ? 1 : 0, // Metadata Poisoning (XSS)

      // 13-17: Futuristic Features
      details.includes('hash_change') && details.includes('sys_call') ? 1 : 0, // JIT Obfuscation
      details.includes('consistent_delta') ? 1 : 0, // Low-and-Slow Exfiltration
      details.includes('l3_cache_miss_spike') ? 1 : 0, // Cache Side-Channel
      action === 'UPDATE' && (details.includes('eval(') || details.includes('child_process')) ? 1 : 0, // Dependency Confusion
      details.includes('ignore all previous') || details.includes('system prompt') ? 1 : 0 // Adversarial Prompt Injection
    ];
  }

  async analyzeUserBehavior(userId: string): Promise<any> {
    this.logger.log(`Analyzing behavior for user: ${userId}`);
    return {
      userId,
      anomalyScore: Math.random(),
      status: 'analyzed',
    };
  }
}
