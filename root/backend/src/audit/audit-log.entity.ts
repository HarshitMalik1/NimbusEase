import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn } from 'typeorm';

export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR';

@Entity('audit_logs')
export class AuditLog {
  @ObjectIdColumn()
  id: ObjectId;

  @Column()
  userId: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  metadata: any;

  @Column({ default: 'INFO' })
  severity: AuditSeverity;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}
