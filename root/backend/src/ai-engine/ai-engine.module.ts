import { Module } from '@nestjs/common';
import { AiEngineService } from './ai-engine.service';
import { SecurityAgentService } from './security-agent.service';
import { DataSimulatorService } from './data-simulator.service';
import { SecurityDashboardService } from './security-dashboard.service';
import { SecurityController } from './security.controller';
import { RedisMockService } from './redis-mock.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBehaviorProfile } from './entities/user-behavior-profile.entity';
import { AnomalyDetection } from './entities/anomaly-detection.entity';
import { ABTestRecord } from './entities/ab-test-record.entity';
import { ABTestingService } from './ab-testing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserBehaviorProfile, AnomalyDetection, ABTestRecord]),
  ],
  controllers: [SecurityController],
  providers: [
    AiEngineService, 
    SecurityAgentService, 
    DataSimulatorService, 
    SecurityDashboardService, 
    RedisMockService,
    ABTestingService
  ],
  exports: [AiEngineService, SecurityAgentService, DataSimulatorService, SecurityDashboardService, ABTestingService],
})
export class AiEngineModule {}