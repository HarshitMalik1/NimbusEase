import { Module } from '@nestjs/common';
import { AiEngineService } from './ai-engine.service';
import { SecurityAgentService } from './security-agent.service';
import { DataSimulatorService } from './data-simulator.service';
import { SecurityDashboardService } from './security-dashboard.service';
import { SecurityController } from './security.controller';
import { RedisMockService } from './redis-mock.service';

@Module({
  controllers: [SecurityController],
  providers: [AiEngineService, SecurityAgentService, DataSimulatorService, SecurityDashboardService, RedisMockService],
  exports: [AiEngineService, SecurityAgentService, DataSimulatorService, SecurityDashboardService],
})
export class AiEngineModule {}