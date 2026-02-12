import { AiEngineService } from '../ai-engine/ai-engine.service';
import { DataSimulatorService } from '../ai-engine/data-simulator.service';
import { SecurityAgentService } from '../ai-engine/security-agent.service';
import { RedisMockService } from '../ai-engine/redis-mock.service';
import { Logger } from '@nestjs/common';

async function runComprehensiveSimulation() {
  const logger = new Logger('ComprehensiveSim');
  logger.log('🚀 Starting Comprehensive Threat Simulation (All 11 Attack Vectors)...');

  // Initialize Services
  const redis = new RedisMockService();
  const securityAgent = new SecurityAgentService();
  const aiEngine = new AiEngineService(securityAgent, redis);
  const simulator = new DataSimulatorService();

  // Helper to generate a log
  const generateLog = (user: string, ip: string, action: string, resource: string, details: string, status: number) => ({
    userId: user,
    ipAddress: ip,
    action: action,
    metadata: { resource, details },
    severity: status >= 400 ? 'ERROR' : 'INFO',
    createdAt: new Date(),
    details: details,
    resource: resource,
    statusCode: status
  });

  // 1. TRAINING (Synthetic Data)
  logger.log('\n🏋️ Phase 1: Training Updated Model (13 Features)...');
  // We'll just generate some generic noise for training base, the heuristic/hard rules will catch the specific signatures
  const trainingData = simulator.generateLogs(500, 0.2); 
  await aiEngine.trainModel(trainingData);

  // 2. ATTACK SCENARIOS
  logger.log('\n⚔️ Phase 2: Simulating Attacks...');

  const scenarios = [
    { name: 'SSRF via Storage Metadata', log: generateLog('user_ssrf', '1.2.3.4', 'UPDATE', '/profile/avatar', '{"url": "http://169.254.169.254/latest/meta-data/"}', 200) },
    { name: 'Resource Exhaustion', log: generateLog('user_exhaust', '1.2.3.4', 'POST', '/api/upload', 'Upload 1KB file', 429) },
    { name: 'Excessive Data Exposure', log: generateLog('user_scrape', '1.2.3.4', 'READ', '/api/files/metadata', 'scraping metadata fields', 200) },
    { name: 'Privilege Escalation', log: generateLog('user_hacker', '1.2.3.4', 'PATCH', '/api/profile', '{"role": "admin"}', 200) },
    { name: 'Metadata Poisoning (XSS)', log: generateLog('user_xss', '6.6.6.6', 'UPLOAD', '/files/script.jpg', '<script>alert(1)</script>', 200) },
    { name: 'SQL Injection', log: generateLog('user_sqli', '45.23.12.99', 'QUERY', 'users_table', "SELECT * FROM users WHERE id='1' OR '1'='1'", 200) },
    { name: 'Path Traversal', log: generateLog('user_path', '10.0.0.5', 'READ', 'storage/../../etc/passwd', 'Accessing system file', 403) },
    { name: 'Ransomware', log: generateLog('user_crypto', '172.16.0.20', 'DELETE', '/storage/files/doc.pdf', 'Renaming to .encrypted', 200) },
    { name: 'Brute Force', log: generateLog('user_brute', '192.168.1.105', 'LOGIN', '/api/auth/login', 'Failed login attempt', 401) }
  ];

  for (const scenario of scenarios) {
    console.log(`\nTesting: ${scenario.name}`);
    await aiEngine.handleAuditLog(scenario.log as any);
  }

  // 3. STATEFUL ATTACKS (IDOR, MitC, Slow Leak) - Quick Check
  logger.log('\n⚔️ Phase 3: Simulating Stateful Attacks...');
  await redis.flushall();
  
  // IDOR
  console.log('\nTesting: IDOR (Stateful)');
  for (let i = 0; i < 11; i++) {
     await aiEngine.handleAuditLog(generateLog('user_idor', '192.168.1.50', 'READ', `/file/${i}`, 'Access Denied', 403) as any);
  }

  logger.log('\n--------------------------------------------------');
  logger.log('🏁 Comprehensive Simulation Complete.');
}

runComprehensiveSimulation().catch(err => console.error(err));
