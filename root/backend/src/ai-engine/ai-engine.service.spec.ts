import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AiEngineService } from './ai-engine.service';
import { AnomalyDetection } from './entities/anomaly-detection.entity';
import { UserBehaviorProfile } from './entities/user-behavior-profile.entity';
import { AuditLog } from '../audit/audit-log.entity';

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs', () => ({
  loadLayersModel: jest.fn().mockResolvedValue({
    predict: jest.fn().mockReturnValue({
      data: jest.fn().mockResolvedValue([0.5]),
      dispose: jest.fn(),
    }),
  }),
  sequential: jest.fn().mockReturnValue({
    add: jest.fn(),
    compile: jest.fn(),
    predict: jest.fn().mockReturnValue({
      data: jest.fn().mockResolvedValue([0.5]),
      dispose: jest.fn(),
    }),
  }),
  layers: {
    dense: jest.fn(),
    dropout: jest.fn(),
  },
  train: {
    adam: jest.fn(),
  },
  tensor2d: jest.fn().mockReturnValue({
    dispose: jest.fn(),
  }),
}));

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Risk: LOW. Confidence: 80%.' }],
      }),
    },
  }));
});

describe('AiEngineService', () => {
  let service: AiEngineService;
  let auditLogRepository: any;
  let eventEmitter: EventEmitter2;

  const mockAuditLogRepository = {
    find: jest.fn(),
  };

  const mockAnomalyRepository = {
    create: jest.fn().mockImplementation(dto => ({ ...dto, id: 'anomaly-id' })),
    save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
  };

  const mockBehaviorProfileRepository = {
    findOne: jest.fn(),
    create: jest.fn().mockImplementation(dto => ({ ...dto, id: 'profile-id' })),
    save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiEngineService,
        {
          provide: getRepositoryToken(AnomalyDetection),
          useValue: mockAnomalyRepository,
        },
        {
          provide: getRepositoryToken(UserBehaviorProfile),
          useValue: mockBehaviorProfileRepository,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AiEngineService>(AiEngineService);
    auditLogRepository = module.get(getRepositoryToken(AuditLog));
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeUserBehavior', () => {
    it('should return insufficient_data if there are fewer than 10 logs', async () => {
      auditLogRepository.find.mockResolvedValue(new Array(5).fill({}));
      
      const result = await service.analyzeUserBehavior('user-1');
      
      expect(result).toEqual({ status: 'insufficient_data' });
    });

    it('should return an anomaly score if there are enough logs', async () => {
      const logs = new Array(15).fill({
        action: 'LOGIN',
        createdAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        severity: 'INFO',
        metadata: { size: 100 },
      });
      auditLogRepository.find.mockResolvedValue(logs);
      
      // Mock profile not found to trigger creation
      mockBehaviorProfileRepository.findOne.mockResolvedValue(null);

      const result = await service.analyzeUserBehavior('user-1');
      
      expect(result).toHaveProperty('anomalyScore');
      expect(result.userId).toBe('user-1');
    });
  });
});
