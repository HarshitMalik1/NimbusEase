import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3 } from 'aws-sdk';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ObjectId } from 'mongodb';
import { FileEntity } from './file.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AuditService } from '../audit/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class StorageService {
  private s3!: S3;
  private readonly encryptionAlgorithm = 'aes-256-gcm';
  private readonly storageStrategy: string;
  private readonly localPath: string;

  constructor(
    @InjectRepository(FileEntity)
    private fileRepository: Repository<FileEntity>,
    private blockchainService: BlockchainService,
    private auditService: AuditService,
    private eventEmitter: EventEmitter2,
  ) {
    this.storageStrategy = process.env.STORAGE_STRATEGY || 'aws';
    this.localPath = path.resolve(process.env.LOCAL_STORAGE_PATH || './uploads');

    if (this.storageStrategy === 'aws') {
      this.s3 = new S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
      });
    } else {
      // Ensure local directory exists
      if (!fs.existsSync(this.localPath)) {
        fs.mkdirSync(this.localPath, { recursive: true });
      }
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
    encryptionKey?: string,
  ) {
    try {
      // Generate encryption key if not provided (client-side encryption)
      const key = encryptionKey ? Buffer.from(encryptionKey, 'hex') : crypto.randomBytes(32);

      // Encrypt file
      const { encrypted, iv, authTag } = this.encryptData(fileBuffer, key);

      // Calculate hash before encryption for blockchain
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Storage Key
      const storageKey = `${userId}/${Date.now()}-${fileName}`;

      if (this.storageStrategy === 'aws') {
        // Upload to S3
        await this.s3.upload({
          Bucket: (process.env.AWS_S3_BUCKET || '') as string,
          Key: storageKey,
          Body: encrypted,
          ContentType: mimeType,
          ServerSideEncryption: 'AES256',
          StorageClass: 'STANDARD', // Best for AWS Free Tier (5GB limit)
        }).promise();
      } else {
        // Mock: Save to Local Filesystem
        const fullPath = path.resolve(this.localPath, storageKey);
        if (!fullPath.startsWith(this.localPath)) throw new BadRequestException('Invalid path');

        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, encrypted);
      }

      // Create file record
      const file = this.fileRepository.create({
        userId,
        fileName,
        mimeType,
        size: fileBuffer.length,
        s3Key: storageKey,
        hash: fileHash,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encryptionKeyHash: crypto.createHash('sha256').update(key).digest('hex'),
      });

      await this.fileRepository.save(file);

      // Register on blockchain
      const blockchainTxHash = await this.blockchainService.registerFileHash({
        fileId: file.id.toString(),
        hash: fileHash,
        ownerId: userId,
        timestamp: Date.now(),
        storageUri: storageKey,
      });

      file.blockchainTxHash = blockchainTxHash;
      await this.fileRepository.save(file);

      // Create audit log
      await this.auditService.logAction(
        userId,
        'FILE_UPLOAD',
        {
          resourceId: file.id.toString(),
          fileName,
          size: fileBuffer.length,
          blockchainTxHash,
        },
      );

      // Emit event for monitoring
      this.eventEmitter.emit('file.uploaded', {
        userId,
        fileId: file.id.toString(),
        fileName,
      });

      return {
        fileId: file.id.toString(),
        fileName,
        hash: fileHash,
        blockchainTxHash,
        encryptionKey: !encryptionKey ? key.toString('hex') : undefined,
      };
    } catch (error) {
      throw new BadRequestException(`Upload failed: ${(error as any).message}`);
    }
  }

  async downloadFile(fileId: string, userId: string, decryptionKey: string) {
    if (!ObjectId.isValid(fileId)) throw new NotFoundException('Invalid file ID');
    const file = await this.fileRepository.findOne({
      where: { id: new ObjectId(fileId) },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check ownership or permissions
    if (file.userId !== userId) {
      throw new BadRequestException('Access denied');
    }

    try {
      let fileBuffer: Buffer;

      if (this.storageStrategy === 'aws') {
        // Download from S3
        const s3Object = await this.s3.getObject({
            Bucket: (process.env.AWS_S3_BUCKET || '') as string,
          Key: file.s3Key,
        }).promise();
        fileBuffer = s3Object.Body as Buffer;
      } else {
        // Mock: Read from Local Filesystem
        const fullPath = path.resolve(this.localPath, file.s3Key);
        if (!fullPath.startsWith(this.localPath)) throw new BadRequestException('Invalid path');
        
        if (!fs.existsSync(fullPath)) throw new NotFoundException('Physical file not found in local storage');
        fileBuffer = fs.readFileSync(fullPath);
      }

      // Decrypt file
      const decrypted = this.decryptData(
        fileBuffer,
        Buffer.from(decryptionKey, 'hex'),
        Buffer.from(file.iv, 'hex'),
        Buffer.from(file.authTag, 'hex'),
      );

      // Verify integrity
      const currentHash = crypto.createHash('sha256').update(decrypted).digest('hex');
      const isValid = await this.blockchainService.verifyFileHash(
        file.blockchainTxHash,
        currentHash,
      );

      if (!isValid) {
        await this.auditService.logAction(
          userId,
          'FILE_INTEGRITY_VIOLATION',
          { resourceId: fileId },
          'ERROR',
        );

        this.eventEmitter.emit('security.alert', {
          type: 'INTEGRITY_VIOLATION',
          fileId,
          userId,
        });

        throw new BadRequestException('File integrity check failed - file may be tampered');
      }

      // Update access log
      file.lastAccessedAt = new Date();
      await this.fileRepository.save(file);

      await this.auditService.logAction(
        userId,
        'FILE_DOWNLOAD',
        { resourceId: fileId },
      );

      return {
        buffer: decrypted,
        fileName: file.fileName,
        mimeType: file.mimeType,
        integrityVerified: true,
      };
    } catch (error) {
      throw new BadRequestException(`Download failed: ${(error as any).message}`);
    }
  }

  async verifyFileIntegrity(fileId: string) {
    if (!ObjectId.isValid(fileId)) throw new NotFoundException('Invalid file ID');
    const file = await this.fileRepository.findOne({ where: { id: new ObjectId(fileId) } });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const isValid = await this.blockchainService.verifyFileHash(
      file.blockchainTxHash,
      file.hash,
    );

    return {
      fileId,
      fileName: file.fileName,
      integrityValid: isValid,
      blockchainTxHash: file.blockchainTxHash,
      verifiedAt: new Date(),
    };
  }

  async listFiles(userId: string, page = 1, limit = 20) {
    const [files, total] = await this.fileRepository.findAndCount({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      files: files.map(f => ({
        id: f.id.toString(),
        fileName: f.fileName,
        size: f.size,
        mimeType: f.mimeType,
        createdAt: f.createdAt,
        lastAccessedAt: f.lastAccessedAt,
        blockchainTxHash: f.blockchainTxHash,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteFile(fileId: string, userId: string) {
    if (!ObjectId.isValid(fileId)) throw new NotFoundException('Invalid file ID');
    const file = await this.fileRepository.findOne({ where: { id: new ObjectId(fileId) } });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.userId !== userId) {
      throw new BadRequestException('Access denied');
    }

    // Delete from storage
    if (this.storageStrategy === 'aws') {
      await this.s3.deleteObject({
          Bucket: (process.env.AWS_S3_BUCKET || '') as string,
        Key: file.s3Key,
      }).promise();
    } else {
      // Mock: Delete from Local Filesystem
      const fullPath = path.resolve(this.localPath, file.s3Key);
      if (!fullPath.startsWith(this.localPath)) throw new BadRequestException('Invalid path');

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // Soft delete from database
    file.deletedAt = new Date();
    await this.fileRepository.save(file);

    await this.auditService.logAction(
      userId,
      'FILE_DELETE',
      { resourceId: fileId },
    );

    return { message: 'File deleted successfully' };
  }

  private encryptData(data: Buffer, key: Buffer) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.encryptionAlgorithm, key, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return { encrypted, iv, authTag };
  }

  private decryptData(
    encrypted: Buffer,
    key: Buffer,
    iv: Buffer,
    authTag: Buffer,
  ) {
    const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}
