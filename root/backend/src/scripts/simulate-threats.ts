import { AiEngineService } from '../ai-engine/ai-engine.service';
import { DataSimulatorService } from '../ai-engine/data-simulator.service';
import { SecurityAgentService } from '../ai-engine/security-agent.service';
import { RedisMockService } from '../ai-engine/redis-mock.service';
import { Logger } from '@nestjs/common';

async function runAdvancedSimulation() {
  const logger = new Logger('SecurityTraining');
  
  const redis = new RedisMockService();
  const securityAgent = new SecurityAgentService();
  const aiEngine = new AiEngineService(securityAgent, redis);
  const simulator = new DataSimulatorService();

  // 1. TRAINING PHASE
  logger.log('🏋️ Phase 1: Training TensorFlow Model...');
  const trainingData = simulator.generateLogs(1000, 0.2); // 1000 logs for training
  await aiEngine.trainModel(trainingData);

  // 2. DETECTION PHASE
  logger.log('🔍 Phase 2: Analyzing Live Traffic...');
  const liveTraffic = simulator.generateLogs(10, 0.7); // 10 live logs, high anomaly chance

  for (const log of liveTraffic) {
    // Step A: TensorFlow fast-check
    const aiPrediction = await aiEngine.predict(log);
    
    if (aiPrediction.isAnomaly) {
      console.log(`
🚨 TF.js Detected Anomaly: [${log.action}] on ${log.resource} (Confidence: ${aiPrediction.confidence.toFixed(2)})`);
      
      // Step B: DeepSeek R1 Analysis & Mitigation
      const analysis = await securityAgent.analyzeThreat(log);
      console.log(`   🤖 AI Verdict: ${analysis.attack_type}. Action: ${analysis.mitigation_action}`);
      
      await securityAgent.executeMitigation(analysis.mitigation_action, analysis.target);
    } else {
      console.log(`✅ Normal Traffic: [${log.action}] ${log.resource}`);
    }
  }

  // 3. UNBLOCK PHASE (The "Only Way Possible")
  console.log('\n🔓 Phase 3: Manual Recovery (Unblocking)');
  
  const ipRes = await securityAgent.unblock('IP', '192.168.1.105');
  console.log(`   ✅ ${ipRes.message}`);

  const userRes = await securityAgent.unblock('USER', 'user_2');
  console.log(`   ✅ ${userRes.message}`);

  const storageRes = await securityAgent.unblock('STORAGE', 'STORAGE_BUCKET');
  console.log(`   ✅ ${storageRes.message}`);

  logger.log('🏁 Advanced Security Simulation Complete.');
}

runAdvancedSimulation().catch(err => console.error(err));