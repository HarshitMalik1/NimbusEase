import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ObjectId } from 'mongodb';
import { FileEntity } from './file.entity';
import { UserRole } from '../users/user.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AuditService } from '../audit/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private s3Client!: S3Client;
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
    this.storageStrategy = process.env.STORAGE_STRATEGY || 'local';
    this.localPath = path.resolve(process.env.LOCAL_STORAGE_PATH || './uploads');

    if (this.storageStrategy === 'aws') {
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      const bucket = process.env.AWS_S3_BUCKET;

      if (!accessKeyId || !secretAccessKey || !bucket) {
        throw new Error('CRITICAL: Cloud Storage (AWS) is enabled but AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or AWS_S3_BUCKET is missing in .env');
      }

      this.s3Client = new S3Client({
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        region: process.env.AWS_REGION || 'us-east-1',
      });
    } else {
      // Ensure local directory exists
      if (!fs.existsSync(this.localPath)) {
        fs.mkdirSync(this.localPath, { recursive: true });
      }
    }
  }

  async uploadFile(
    fileBuffer: Buffer | null,
    fileName: string,
    mimeType: string,
    userId: string,
    encryptionKey?: string,
    filePath?: string,
  ) {
    let finalBuffer: Buffer;
    
    if (filePath && fs.existsSync(filePath)) {
      finalBuffer = fs.readFileSync(filePath);
    } else if (fileBuffer) {
      finalBuffer = fileBuffer;
    } else {
      throw new BadRequestException('No file data provided');
    }

    try {
      const key = encryptionKey ? Buffer.from(encryptionKey, 'hex') : crypto.randomBytes(32);
      const { encrypted, iv, authTag } = this.encryptData(finalBuffer, key);
      const fileHash = crypto.createHash('sha256').update(finalBuffer).digest('hex');
      const storageKey = `${userId}/${Date.now()}-${fileName}`;

      if (this.storageStrategy === 'aws') {
        const command = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET || '',
          Key: storageKey,
          Body: encrypted,
          ContentType: mimeType,
        });
        await this.s3Client.send(command);
      } else {
        const fullPath = path.resolve(this.localPath, storageKey);
        if (!fullPath.startsWith(this.localPath)) throw new BadRequestException('Invalid path');
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, encrypted);
      }

      const file = this.fileRepository.create({
        userId,
        fileName,
        mimeType,
        size: finalBuffer.length,
        s3Key: storageKey,
        hash: fileHash,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encryptionKeyHash: crypto.createHash('sha256').update(key).digest('hex'),
      });

      await this.fileRepository.save(file);

      const blockchainTxHash = await this.blockchainService.registerFileHash({
        fileId: file.id.toString(),
        hash: fileHash,
        ownerId: userId,
        timestamp: Date.now(),
        storageUri: storageKey,
      });

      file.blockchainTxHash = blockchainTxHash;
      await this.fileRepository.save(file);

      await this.auditService.logAction(userId, 'FILE_UPLOAD', {
        resourceId: file.id.toString(),
        fileName,
        size: finalBuffer.length,
        blockchainTxHash,
      });

      this.eventEmitter.emit('file.uploaded', { userId, fileId: file.id.toString(), fileName });

      console.log(`[STORAGE_DEBUG] Uploaded with key hash: ${crypto.createHash('sha256').update(key).digest('hex')}`);
      
      // 🧹 Cleanup: Delete temporary file after successful upload/scan
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`[STORAGE_DEBUG] Cleaned up temp file: ${filePath}`);
        } catch (e) {
          console.error(`[STORAGE_DEBUG] Failed to cleanup temp file: ${filePath}`, e);
        }
      }

      return {
        fileId: file.id.toString(),
        fileName,
        hash: fileHash,
        blockchainTxHash,
        encryptionKey: key.toString('hex'),
      };
    } catch (error: any) {
      // 🧹 Cleanup on error too
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      console.error(`[STORAGE_DEBUG] Upload failed:`, error);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }

  async downloadFile(fileId: string, userId: string, userRole: string, decryptionKey: string) {
    if (!ObjectId.isValid(fileId)) throw new NotFoundException('Invalid file ID');
    const file = await this.fileRepository.findOne({ where: { _id: new ObjectId(fileId) } as any });
    if (!file) throw new NotFoundException('File not found');
    
    // Check if user is owner.
    if (file.userId !== userId) {
       console.warn(`[STORAGE_DEBUG] Unauthorized access attempt: User ${userId.substring(0, 8)}... attempting to access file owned by ${file.userId.substring(0, 8)}...`);
       throw new BadRequestException('Access denied'); 
    }

    // === NEW: Verify the provided decryption key before proceeding ===
    const providedKeyHash = crypto.createHash('sha256').update(Buffer.from(decryptionKey, 'hex')).digest('hex');
    if (providedKeyHash !== file.encryptionKeyHash) {
      console.error(`[STORAGE_DEBUG] Invalid decryption key provided for file ${fileId}.`);
      await this.auditService.logAction(userId, 'DOWNLOAD_FAILED', {
        resourceId: file.id.toString(),
        reason: 'Invalid decryption key',
      }, 'ERROR');
      throw new BadRequestException('Invalid decryption key.');
    }
    console.log('[STORAGE_DEBUG] Decryption key hash verified successfully.');
    // ===============================================================

    try {
      let fileBuffer: Buffer;

      if (this.storageStrategy === 'aws') {
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET || '',
          Key: file.s3Key,
        });
        const response = await this.s3Client.send(command);
        fileBuffer = await this.streamToBuffer(response.Body as Readable);
      } else {
        const fullPath = path.resolve(this.localPath, file.s3Key);
        if (!fs.existsSync(fullPath)) throw new NotFoundException('Physical file not found');
        fileBuffer = fs.readFileSync(fullPath);
      }

      console.log(`[STORAGE_DEBUG] Decrypting with key: ${decryptionKey.substring(0, 5)}...`);
      const keyBuffer = Buffer.from(decryptionKey, 'hex');
      
      const decrypted = this.decryptData(
        fileBuffer,
        keyBuffer,
        Buffer.from(file.iv, 'hex'),
        Buffer.from(file.authTag, 'hex'),
      );

      const currentHash = crypto.createHash('sha256').update(decrypted).digest('hex');
      const isValid = await this.blockchainService.verifyFileHash(file.blockchainTxHash, currentHash);

      if (!isValid) {
        // Log the content hash mismatch
        console.error(`[STORAGE_DEBUG] File content hash mismatch for file ${fileId}.`);
        await this.auditService.logAction(userId, 'DOWNLOAD_FAILED', {
          resourceId: file.id.toString(),
          reason: 'File integrity check failed (content hash mismatch)',
        }, 'ERROR');
        throw new BadRequestException('File integrity check failed');
      }
      
      // === NEW: Log content hash verification success ===
      console.log('[STORAGE_DEBUG] File content hash verified successfully against blockchain.');
      // =================================================

      file.lastAccessedAt = new Date();
      await this.fileRepository.save(file);
      
      await this.auditService.logAction(userId, 'FILE_DOWNLOADED', {
        resourceId: file.id.toString(),
        fileName: file.fileName,
      }, 'INFO');

      const sanitizedFilename = file.fileName.replace(/[\n\r]/g, '_');
      console.log(`[STORAGE_DEBUG] Download successful: ${sanitizedFilename}`);
      return { buffer: decrypted, fileName: file.fileName, mimeType: file.mimeType, integrityVerified: true };
    } catch (error: any) {
      console.error(`[STORAGE_DEBUG] Decryption failed error:`, error.message);
      throw new BadRequestException(`Download failed: ${error.message}`);
    }
  }

  async verifyFileIntegrity(fileId: string, userId: string, userRole: string) {
    if (!ObjectId.isValid(fileId)) throw new NotFoundException('Invalid file ID');
    const file = await this.fileRepository.findOne({ where: { _id: new ObjectId(fileId) } as any });
    if (!file) throw new NotFoundException('File not found');

    if (file.userId !== userId) {
      throw new BadRequestException('Access denied');
    }

    const isValid = await this.blockchainService.verifyFileHash(file.blockchainTxHash, file.hash);
    return { fileId, fileName: file.fileName, integrityValid: isValid, blockchainTxHash: file.blockchainTxHash, verifiedAt: new Date() };
  }

  async listFiles(userId: string, userRole: string, page = 1, limit = 20) {
    console.log('[STORAGE_DEBUG] Listing files. Applying explicit non-deleted filter.');
    const query: any = {
      deletedAt: { $exists: false } // Explicitly find documents where deletedAt does NOT exist
    };
    if (userRole !== UserRole.ADMIN) {
      query.userId = userId;
    }

    const [files, total] = await this.fileRepository.findAndCount({
      where: query,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' } as any,
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
        userId: f.userId
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteFile(fileId: string, userId: string, userRole: string) {
    console.log(`[STORAGE_DEBUG] Attempting to delete file ID: ${fileId} for user ID: ${userId}`);
    if (!ObjectId.isValid(fileId)) throw new NotFoundException('Invalid file ID');
    
    const file = await this.fileRepository.findOne({ where: { _id: new ObjectId(fileId) } as any });
    if (!file) throw new NotFoundException('File not found');
    
    if (file.userId !== userId) {
       throw new BadRequestException('Access denied');
    }

    if (this.storageStrategy === 'aws') {
      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET || '',
        Key: file.s3Key,
      });
      await this.s3Client.send(command);
    } else {
      const fullPath = path.resolve(this.localPath, file.s3Key);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    // Perform a soft delete to set the deletedAt flag
    console.log(`[STORAGE_DEBUG] Performing soft delete on database record for file ID: ${file.id}`);
    const deleteResult = await this.fileRepository.softDelete(file.id);
    console.log('[STORAGE_DEBUG] Soft delete result:', deleteResult);


    await this.auditService.logAction(userId, 'FILE_DELETED', {
      resourceId: file.id.toString(),
      fileName: file.fileName,
    }, 'WARNING');

    return { message: 'File soft-deleted successfully' };
  }

  private encryptData(data: Buffer, key: Buffer) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.encryptionAlgorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { encrypted, iv, authTag };
  }

  private decryptData(encrypted: Buffer, key: Buffer, iv: Buffer, authTag: Buffer) {
    const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
