import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from './blockchain.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlockchainRecord } from './blockchain-record.entity';
import { Repository } from 'typeorm';
import { Gateway } from 'fabric-network';

// Mock fabric-network
const mockSubmitTransaction = jest.fn();
const mockEvaluateTransaction = jest.fn();
const mockGetContract = jest.fn().mockReturnValue({
  submitTransaction: mockSubmitTransaction,
  evaluateTransaction: mockEvaluateTransaction,
});
const mockGetNetwork = jest.fn().mockResolvedValue({
  getContract: mockGetContract,
});
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('fabric-network', () => {
  return {
    Gateway: jest.fn().mockImplementation(() => ({
      connect: mockConnect,
      getNetwork: mockGetNetwork,
      disconnect: mockDisconnect,
    })),
    Wallets: {
      newFileSystemWallet: jest.fn().mockResolvedValue({
        get: jest.fn().mockResolvedValue(true),
      }),
    },
  };
});

// Mock fs and path to avoid real file system errors
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue('{}'),
  };
});

jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    resolve: jest.fn().mockReturnValue('mock/path'),
    join: jest.fn().mockReturnValue('mock/path'),
  };
});

describe('BlockchainService', () => {
  let service: BlockchainService;
  let repo: Repository<BlockchainRecord>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        {
          provide: getRepositoryToken(BlockchainRecord),
          useValue: {
            create: jest.fn().mockImplementation((dto) => dto),
            save: jest.fn().mockResolvedValue(true),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
    repo = module.get<Repository<BlockchainRecord>>(getRepositoryToken(BlockchainRecord));

    // Reset mocks
    mockConnect.mockClear();
    mockSubmitTransaction.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize blockchain connection successfully', async () => {
      await service.onModuleInit();
      expect(mockConnect).toHaveBeenCalled();
      expect(mockGetNetwork).toHaveBeenCalled();
    });
  });

  describe('registerFileHash', () => {
    it('should successfully register a file and save to DB', async () => {
      await service.onModuleInit();
      mockSubmitTransaction.mockResolvedValueOnce(Buffer.from('mock-record-id'));

      const result = await service.registerFileHash({
        fileId: 'file123',
        hash: 'abc123hash',
        ownerId: 'user1',
        timestamp: 1234567890,
        storageUri: 's3://bucket/file',
      });

      expect(mockSubmitTransaction).toHaveBeenCalledWith(
        'CreateFile',
        'file123',
        'abc123hash',
        'user1',
        '1234567890',
        's3://bucket/file'
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('should handle blockchain connection failure gracefully', async () => {
       // Simulate connection not established
       // Force service.contract to be undefined by mocking initialize to fail
       // But locally, we can just spy on the method if it wasn't private or just mock the dependencies
       
       mockSubmitTransaction.mockRejectedValueOnce(new Error('Chaincode error'));
       await service.onModuleInit();

       await expect(service.registerFileHash({
        fileId: 'file123',
        hash: 'abc123hash',
        ownerId: 'user1',
        timestamp: 1234567890,
        storageUri: 's3://bucket/file',
      })).rejects.toThrow('Blockchain registration failed');
    });
  });

  describe('Verification Loophole Checks', () => {
     it('should fail if blockchain record is missing from local DB (Consistency Check)', async () => {
         jest.spyOn(repo, 'findOne').mockResolvedValue(null);
         
         const result = await service.verifyFileHash('tx123', 'hash123');
         expect(result).toBeFalsy(); // Should handle the error and return false or throw
     });
  });
});
