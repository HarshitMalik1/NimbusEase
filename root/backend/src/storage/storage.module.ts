import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { FileEntity } from './file.entity';
import { AuditModule } from '../audit/audit.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity]),
    AuditModule,
    BlockchainModule,
  ],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService, TypeOrmModule],
})
export class StorageModule {}
