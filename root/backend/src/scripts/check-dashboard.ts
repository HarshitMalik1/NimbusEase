import { SecurityDashboardService } from '../ai-engine/security-dashboard.service';
import { SecurityAgentService } from '../ai-engine/security-agent.service';
import { Logger } from '@nestjs/common';

async function checkDashboard() {
  const logger = new Logger('DashboardCheck');
  
  // 1. Setup Services
  const securityAgent = new SecurityAgentService();
  const dashboard = new SecurityDashboardService(securityAgent);

  // 2. Simulate some blocked threats
  logger.log('🔥 Simulating active threats...');
  await securityAgent.executeMitigation('BLOCK_IP', '192.168.1.105'); // Brute Force
  await securityAgent.executeMitigation('REVOKE_USER', 'user_alice'); // MitC
  await securityAgent.executeMitigation('THROTTLE', 'user_eve'); // Data Exfiltration
  await securityAgent.executeMitigation('SECURITY_LOCKDOWN', 'hacker_bob'); // Privilege Escalation

  // 3. Fetch Dashboard Data
  logger.log('\n📊 Fetching Security Dashboard...');
  const health = dashboard.getSystemHealth();

  console.dir(health, { depth: null, colors: true });
}

checkDashboard().catch(console.error);
