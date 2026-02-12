import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_behavior_profiles')
export class UserBehaviorProfile {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  userId!: string;

  @Column()
  baselineFeatures!: any;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
