import { AiEngineService } from '../ai-engine/ai-engine.service';
import { SecurityAgentService } from '../ai-engine/security-agent.service';
import { RedisMockService } from '../ai-engine/redis-mock.service';
import { Logger } from '@nestjs/common';

async function testSingle22B() {
  const logger = new Logger('22B-Test');
  const redis = new RedisMockService();
  const securityAgent = new SecurityAgentService();
  const abTesting = { getVariant: () => 'A', logComparison: async () => {} } as any;
  const aiEngine = new AiEngineService(securityAgent, redis, abTesting);

  const log = {
    userId: 'hacker_101',
    ipAddress: '1.2.3.4',
    action: 'UPDATE',
    details: '{"url": "http://169.254.169.254/latest/meta-data/"}', // SSRF Attempt
    resource: '/api/profile/metadata',
    statusCode: 200,
    createdAt: new Date()
  };

  logger.log('🚀 Sending SINGLE SSRF request to Llama 3 22B in LM Studio...');
  logger.log('Note: This may take 30-60 seconds depending on your GPU.');

  const start = Date.now();
  try {
    const analysis = await securityAgent.analyzeThreat(log);
    const duration = (Date.now() - start) / 1000;
    
    console.log(`\n✅ AI Response received in ${duration}s:`)
    console.dir(analysis, { depth: null, colors: true });
  } catch (err: any) {
    logger.error(`❌ Test failed: ${err.message}`);
  }
}

testSingle22B().catch(console.error);
