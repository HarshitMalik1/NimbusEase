import { Entity, Column, ObjectIdColumn, ObjectId, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('files')
export class FileEntity {
  @ObjectIdColumn()
  id: ObjectId;

  @Column()
  userId: string;

  @Column()
  fileName: string;

  @Column()
  mimeType: string;

  @Column()
  size: number;

  @Column()
  s3Key: string;

  @Column()
  hash: string;

  @Column()
  iv: string;

  @Column()
  authTag: string;

  @Column()
  encryptionKeyHash: string;

  @Column({ nullable: true })
  blockchainTxHash: string;

  @Column({ default: 1 })
  version: number;

  @Column({ nullable: true })
  metadata: any;

  @Column({ nullable: true })
  lastAccessedAt: Date;

  @Column({ default: 0 })
  accessCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt: Date;
}