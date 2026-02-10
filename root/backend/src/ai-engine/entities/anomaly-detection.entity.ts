import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('anomaly_detections')
export class AnomalyDetection {
  @ObjectIdColumn()
  id: ObjectId;

  @Column()
  userId: string;

  @Column()
  score: number;

  @Column()
  features: any;

  @Column({ nullable: true })
  llmAnalysis: any;

  @Column({ default: 'DETECTED' })
  status: 'DETECTED' | 'ANALYZED' | 'RESOLVED';

  @CreateDateColumn()
  detectedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
