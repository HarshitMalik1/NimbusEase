import { AiEngineService } from '../ai-engine/ai-engine.service';
import { DataSimulatorService } from '../ai-engine/data-simulator.service';
import { SecurityAgentService } from '../ai-engine/security-agent.service';
import { RedisMockService } from '../ai-engine/redis-mock.service';
import { Logger } from '@nestjs/common';

async function runAdvancedThreatSimulation() {
  const logger = new Logger('AdvancedThreatSim');
  logger.log('🚀 Starting Advanced Threat Simulation (IDOR, MitC, Slow Leak)...');

  // Initialize Services
  const redis = new RedisMockService();
  const securityAgent = new SecurityAgentService();
  const aiEngine = new AiEngineService(securityAgent, redis);
  
  // MOCK LOG GENERATOR
  const generateLog = (user, ip, action, resource, status) => ({
    userId: user,
    ipAddress: ip,
    action: action,
    metadata: { resource },
    severity: status === 403 ? 'ERROR' : 'INFO',
    createdAt: new Date()
  });

  // SCENARIO 1: IDOR Attack
  // User 'bob' tries to access files 101, 102, 103, 104... and gets 403s.
  logger.log('\n🎭 SCENARIO 1: IDOR Attack (Insecure Direct Object Reference)');
  const idorLogs = [];
  for (let i = 0; i < 15; i++) {
    idorLogs.push(generateLog('user_bob', '192.168.1.50', 'READ', `/file/confidential_doc_${i}`, 403));
  }
  
  for (const log of idorLogs) {
    await aiEngine.handleAuditLog(log as any);
  }

  // SCENARIO 2: Man-in-the-Cloud (MitC)
  // User 'alice' logs in from India, then USA, then China in short sequence.
  logger.log('\n--------------------------------------------------');
  logger.log('🎭 SCENARIO 2: Man-in-the-Cloud (MitC) - Impossible Travel');
  await redis.flushall(); // Clear history for clean test
  
  const mitcLogs = [
    generateLog('user_alice', '103.20.1.1', 'LOGIN', 'Session_Start_Delhi', 200),
    generateLog('user_alice', '103.20.1.1', 'READ', '/my-files/photo.jpg', 200),
    generateLog('user_alice', '54.200.10.1', 'READ', '/my-files/secret.txt', 200), // AWS US-East
    generateLog('user_alice', '89.10.1.1', 'READ', '/my-files/notes.txt', 200), // Europe
    generateLog('user_alice', '54.200.10.1', 'WRITE', '/my-files/malware.exe', 200),
    generateLog('user_alice', '103.20.1.1', 'READ', '/my-files/photo2.jpg', 200),
    generateLog('user_alice', '89.10.1.1', 'DELETE', '/my-files/backup.zip', 200),
    generateLog('user_alice', '1.1.1.1', 'READ', '/my-files/test.txt', 200),
    generateLog('user_alice', '2.2.2.2', 'READ', '/my-files/test2.txt', 200),
    generateLog('user_alice', '3.3.3.3', 'READ', '/my-files/test3.txt', 200), // 10th event triggers analysis
  ];

  for (const log of mitcLogs) {
    await aiEngine.handleAuditLog(log as any);
  }

  // SCENARIO 3: Data Exfiltration (Slow Leak)
  // User 'eve' downloads 10 files sequentially.
  logger.log('\n--------------------------------------------------');
  logger.log('🎭 SCENARIO 3: Data Exfiltration (Slow Leak)');
  await redis.flushall();

  const leakLogs = [];
  for (let i = 0; i < 12; i++) {
    leakLogs.push(generateLog('user_eve', '172.16.0.99', 'READ', `/company-secrets/client_list_part_${i}.csv`, 200));
  }

  for (const log of leakLogs) {
    await aiEngine.handleAuditLog(log as any);
  }

  logger.log('\n--------------------------------------------------');
  logger.log('🏁 Advanced Simulation Complete.');
}

runAdvancedThreatSimulation().catch(err => console.error(err));
