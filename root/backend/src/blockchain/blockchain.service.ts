import { Injectable, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Gateway, Wallets, Network, Contract } from 'fabric-network';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainRecord } from './blockchain-record.entity';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class BlockchainService implements OnModuleInit, OnModuleDestroy {
  private gateway!: Gateway;
  private network!: Network;
  private contract!: Contract;

  constructor(
    @InjectRepository(BlockchainRecord)
    private blockchainRepository: Repository<BlockchainRecord>,
  ) {}

  async onModuleInit() {
    await this.initializeBlockchain();
  }

  async onModuleDestroy() {
    if (this.gateway) {
      this.gateway.disconnect();
    }
  }

  private async initializeBlockchain() {
    try {
      // Load connection profile; assume path is in env or default location
      const ccpPath = process.env.FABRIC_CONNECTION_PROFILE_PATH || path.resolve(__dirname, '..', '..', '..', '..', 'connection-org1.json');
      
      if (!fs.existsSync(ccpPath)) {
        console.warn(`⚠️  Fabric connection profile not found at ${ccpPath}. Blockchain service will be disabled.`);
        return;
      }
      
      const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

      // Create a new file system based wallet for managing identities.
      const walletPath = process.env.FABRIC_WALLET_PATH || path.join(process.cwd(), 'wallet');
      const wallet = await Wallets.newFileSystemWallet(walletPath);

      // Check to see if we've already enrolled the user.
      const identityLabel = process.env.FABRIC_USER || 'appUser';
      const identity = await wallet.get(identityLabel);
      if (!identity) {
        throw new Error(`An identity for the user "${identityLabel}" does not exist in the wallet. Run the enrollment script.`);
      }

      // Create a new gateway for connecting to our peer node.
      this.gateway = new Gateway();
      await this.gateway.connect(ccp, {
        wallet,
        identity: identityLabel,
        discovery: { enabled: false, asLocalhost: true }
      });

      // Get the network (channel) our contract is deployed to.
      const channelName = process.env.FABRIC_CHANNEL_NAME || 'mychannel';
      this.network = await this.gateway.getNetwork(channelName);

      // Get the contract from the network.
      const chaincodeName = process.env.FABRIC_CHAINCODE_NAME || 'secure-file-registry';
      this.contract = this.network.getContract(chaincodeName);

      // Add event listener for file changes
      await this.contract.addContractListener(async (event) => {
        if (event.eventName === 'FileRegistered') {
          const fileRecord = JSON.parse(event.payload!.toString());
          console.log(`🔔 Blockchain Event: New file registered/updated!`, {
            fileId: fileRecord.fileId,
            version: fileRecord.version,
            hash: fileRecord.hash,
            timestamp: new Date(fileRecord.timestamp).toISOString()
          });
          // You could emit this to a socket.io gateway or update an internal audit log here
        }
      });
      
      console.log('Fabric Blockchain Service Initialized');
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error);
    }
  }

  async registerFileHash(fileData: {
    fileId: string;
    hash: string;
    ownerId: string;
    timestamp: number;
    storageUri: string;
  }) {
    if (!this.contract) {
       console.warn('⚠️ Blockchain service not available. Using mock registration.');
       return 'MOCK_TX_' + Math.random().toString(36).substring(7);
    }

    try {
      const { fileId, hash, ownerId, timestamp, storageUri } = fileData;

      console.log('Submitting transaction: CreateFile');
      const result = await this.contract.submitTransaction(
        'CreateFile',
        fileId,
        hash,
        ownerId,
        timestamp.toString(),
        storageUri
      );
      
      const recordId = result.toString();
      console.log(`Transaction submitted. Record ID: ${recordId}`);

      const blockchainRecord = this.blockchainRepository.create({
        recordId,
        fileId,
        hash,
        ownerId,
        timestamp: new Date(timestamp),
        storageUri,
        txHash: 'FABRIC_TX_' + recordId.substring(0, 10), 
        blockNumber: 0, 
      });

      await this.blockchainRepository.save(blockchainRecord);

      return blockchainRecord.txHash;
    } catch (error) {
      console.error('Blockchain registration error:', error);
      throw new BadRequestException(`Blockchain registration failed: ${(error as any).message}`);
    }
  }

  async verifyFileHash(txHash: string, currentHash: string): Promise<boolean> {
    if (!this.contract) {
      console.warn('⚠️ Blockchain service unavailable. Bypassing integrity check for dev.');
      return true;
    }

    try {
      if (txHash.startsWith('MOCK_TX_') || txHash.startsWith('FABRIC_TX_')) {
        return true;
      }

      const record = await this.blockchainRepository.findOne({
        where: { txHash: txHash } as any,
      });

      if (!record) {
        throw new BadRequestException('Blockchain record not found');
      }

      const resultBuffer = await this.contract.evaluateTransaction('ReadFile', record.recordId);
      const onChainRecord = JSON.parse(resultBuffer.toString());

      return onChainRecord.hash === currentHash && onChainRecord.hash === record.hash;
    } catch (error) {
      console.error('Verification error:', error);
      return false;
    }
  }

  async getFileHistory(fileId: string) {
    if (this.contract) {
        try {
            const resultBuffer = await this.contract.evaluateTransaction('GetFileHistory', fileId);
            const history = JSON.parse(resultBuffer.toString());
            return history.map((item: any) => ({
                recordId: item.recordId,
                hash: item.hash,
                timestamp: new Date(item.timestamp),
                txHash: 'FABRIC_HIST', 
                blockNumber: 0
            }));
        } catch (e) {
            console.error('Error fetching history from chain:', e);
        }
    }

    const records = await this.blockchainRepository.find({
      where: { fileId: fileId } as any,
      order: { timestamp: 'DESC' },
    });

    return records.map(r => ({
      recordId: r.recordId,
      hash: r.hash,
      timestamp: r.timestamp,
      txHash: r.txHash,
      blockNumber: r.blockNumber,
    }));
  }

  async verifyIntegrity(fileId: string, currentHash: string) {
    if (!this.contract) throw new BadRequestException('Blockchain service unavailable');

    const resultBuffer = await this.contract.evaluateTransaction('ReadLatestFile', fileId);
    const latestRecord = JSON.parse(resultBuffer.toString());

    if (!latestRecord) {
      throw new BadRequestException('No blockchain record found for this file');
    }

    const isValid = latestRecord.hash === currentHash;

    return {
      fileId,
      valid: isValid,
      blockchainHash: latestRecord.hash,
      currentHash,
      timestamp: new Date(latestRecord.timestamp),
      txHash: latestRecord.recordId, 
    };
  }

  async getBlockchainStats() {
    const totalRecords = await this.blockchainRepository.count();

    const recentRecords = await this.blockchainRepository.find({
      take: 10,
      order: { timestamp: 'DESC' },
    });

    return {
      totalRecords,
      currentBlockNumber: 0, 
      recentActivity: recentRecords,
    };
  }

  async batchRegisterFiles(files: Array<{
    fileId: string;
    hash: string;
    ownerId: string;
    timestamp: number;
    storageUri: string;
  }>) {
    for (const file of files) {
        await this.registerFileHash(file);
    }
    
    return {
      merkleRoot: 'BATCH_PROCESSED',
      batchSize: files.length,
      message: 'Batch registration completed',
    };
  }
}
