import { Entity, Column, ObjectIdColumn, ObjectId, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ProposalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
}

@Entity('admin_proposals')
export class AdminProposal {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  proposerId!: string;

  @Column()
  actionType!: string; // e.g., 'DATABASE_CHANGE', 'PERMISSION_UPDATE', 'AE_KEY_ACCESS'

  @Column()
  payload!: any;

  @Column()
  approvedBy!: string[]; // Array of Admin IDs who approved

  @Column({
    enum: ProposalStatus,
    default: ProposalStatus.PENDING,
  })
  status!: ProposalStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
