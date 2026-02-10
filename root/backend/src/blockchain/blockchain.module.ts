import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainService } from './blockchain.service';
import { BlockchainRecord } from './blockchain-record.entity';

@Global() // Optional but recommended: blockchain is cross-cutting (audit, storage, monitoring)
@Module({
  imports: [
    TypeOrmModule.forFeature([BlockchainRecord]),
  ],
  providers: [BlockchainService],
  exports: [BlockchainService, TypeOrmModule],
})
export class BlockchainModule {}
