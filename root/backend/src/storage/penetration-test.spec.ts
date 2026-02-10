import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { FileEntity } from './file.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AuditService } from '../audit/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ObjectId } from 'mongodb';

describe('Penetration Test: IDOR & Access Control', () => {
  let service: StorageService;
  let fileRepository: any;

  const mockFile = {
    id: new ObjectId(),
    userId: 'user-a',
    fileName: 'secret.pdf',
    s3Key: 'user-a/secret.pdf',
    iv: Buffer.from('iv').toString('hex'),
    authTag: Buffer.from('tag').toString('hex'),
  };

  const mockFileRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: getRepositoryToken(FileEntity),
          useValue: mockFileRepository,
        },
        {
          provide: BlockchainService,
          useValue: { verifyFileHash: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: AuditService,
          useValue: { logAction: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    fileRepository = module.get(getRepositoryToken(FileEntity));

    // Mock S3
    (service as any).s3 = {
      getObject: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Body: Buffer.from('encrypted-data') }),
      }),
      deleteObject: jest.fn().mockReturnValue({
        promise: jest.fn(),
      }),
    };

    // Mock decryption to not fail during access check
    (service as any).decryptData = jest.fn().mockReturnValue(Buffer.from('decrypted'));
  });

  it('SHOULD FAIL: User B trying to download User A\'s file (IDOR)', async () => {
    fileRepository.findOne.mockResolvedValue(mockFile);

    // User B attempts to access User A's file
    await expect(service.downloadFile(mockFile.id.toString(), 'user-b', 'key'))
      .rejects.toThrow(BadRequestException);
  });

  it('SHOULD FAIL: User B trying to delete User A\'s file (Unauthorized Deletion)', async () => {
    fileRepository.findOne.mockResolvedValue(mockFile);

    // User B attempts to delete User A's file
    await expect(service.deleteFile(mockFile.id.toString(), 'user-b'))
      .rejects.toThrow(BadRequestException);
  });
});
