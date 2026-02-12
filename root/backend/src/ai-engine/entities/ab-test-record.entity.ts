import { Entity, Column, ObjectIdColumn, ObjectId, CreateDateColumn } from 'typeorm';

@Entity('ab_test_records')
export class ABTestRecord {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  userId!: string;

  @Column()
  variant!: 'A' | 'B'; // A = Control (Current), B = Experimental

  @Column()
  action!: string;

  @Column()
  predictionA!: any;

  @Column()
  predictionB!: any;

  @Column()
  selectedVariant!: 'A' | 'B';

  @Column()
  isAnomaly!: boolean;

  @Column()
  confidence!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
