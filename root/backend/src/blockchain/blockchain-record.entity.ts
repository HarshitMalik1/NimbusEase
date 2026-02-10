import { Entity, Column, ObjectIdColumn, ObjectId, CreateDateColumn } from 'typeorm';

@Entity('blockchain_records')
export class BlockchainRecord {
  @ObjectIdColumn()
  id: ObjectId;

  @Column()
  recordId: string; // The ID returned from the smart contract event

  @Column()
  fileId: string;

  @Column()
  hash: string;

  @Column()
  ownerId: string;

  @Column()
  storageUri: string;

  @Column()
  txHash: string;

  @Column()
  blockNumber: number;

  @Column()
  timestamp: Date; // Timestamp from the blockchain/contract

  @CreateDateColumn()
  createdAt: Date; // Timestamp when we saved it locally
}
