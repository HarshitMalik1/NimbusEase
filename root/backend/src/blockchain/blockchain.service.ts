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
        throw new Error(`Fabric connection profile not found at ${ccpPath}. Blockchain service initialization failed.`);
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
        discovery: { enabled: true, asLocalhost: process.env.NODE_ENV !== 'production' }
      });

      // Get the network (channel) our contract is deployed to.
      const channelName = process.env.FABRIC_CHANNEL_NAME || 'mychannel';
      this.network = await this.gateway.getNetwork(channelName);

      // Get the contract from the network.
      const chaincodeName = process.env.FABRIC_CHAINCODE_NAME || 'secure-file-registry';
      this.contract = this.network.getContract(chaincodeName);
      
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
       // Try initializing again or fail
       await this.initializeBlockchain();
       if(!this.contract) throw new BadRequestException('Blockchain service not available');
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

      // Store blockchain record locally for faster queries
      // Fabric usually returns the transaction ID in the SDK context, but here we get the return value of chaincode.
      // We can get the transaction ID from the proposal response if needed, but simplified here.
      
      // NOTE: In Fabric SDK, finding the specific TxHash of the submit requires looking at the response envelope.
      // For simplicity, we might generate a placeholder or use the recordId as the reference.
      
      const blockchainRecord = this.blockchainRepository.create({
        recordId,
        fileId,
        hash,
        ownerId,
        timestamp: new Date(timestamp),
        storageUri,
        txHash: 'FABRIC_TX_' + recordId.substring(0, 10), // Placeholder as real TX ID extraction is complex
        blockNumber: 0, // Not easily available in simple submitTransaction response
      });

      await this.blockchainRepository.save(blockchainRecord);

      return blockchainRecord.txHash;
    } catch (error) {
      console.error('Blockchain registration error:', error);
      throw new BadRequestException(`Blockchain registration failed: ${(error as any).message}`);
    }
  }

  async verifyFileHash(txHash: string, currentHash: string): Promise<boolean> {
    if (!this.contract) return false;

    try {
      const record = await this.blockchainRepository.findOne({
        where: { txHash: txHash } as any,
      });

      if (!record) {
        throw new BadRequestException('Blockchain record not found');
      }

      // Verify on-chain data
      // We read by recordId
      const resultBuffer = await this.contract.evaluateTransaction('ReadFile', record.recordId);
      const onChainRecord = JSON.parse(resultBuffer.toString());

      return onChainRecord.hash === currentHash && onChainRecord.hash === record.hash;
    } catch (error) {
      console.error('Verification error:', error);
      return false;
    }
  }

  async getFileHistory(fileId: string) {
    // We can query local DB or Chaincode history
    // Chaincode history:
    if (this.contract) {
        try {
            const resultBuffer = await this.contract.evaluateTransaction('GetFileHistory', fileId);
            const history = JSON.parse(resultBuffer.toString());
            // Map to expected format
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

    // Fallback to local
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

    // Get latest from chain
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
      txHash: latestRecord.recordId, // Using recordId as reference
    };
  }

  async getBlockchainStats() {
    // Fabric doesn't expose "block height" easily via the contract.
    // We can query the local DB for stats.
    const totalRecords = await this.blockchainRepository.count();

    const recentRecords = await this.blockchainRepository.find({
      take: 10,
      order: { timestamp: 'DESC' },
    });

    return {
      totalRecords,
      currentBlockNumber: 0, // Placeholder
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
    // In Fabric, we can just submit multiple transactions or create a BulkCreate chaincode method.
    // For now, iterate.
    
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