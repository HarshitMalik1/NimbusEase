import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ABTestRecord } from './entities/ab-test-record.entity';

@Injectable()
export class ABTestingService {
  constructor(
    @InjectRepository(ABTestRecord)
    private abTestRepository: Repository<ABTestRecord>,
  ) {}

  /**
   * Determines which variant to use for a given user.
   * Simple 50/50 split based on the last character of the userId.
   */
  getVariant(userId: string): 'A' | 'B' {
    if (!userId) return 'A';
    // Use the hash or last char to keep variant consistent for the same user
    const lastChar = userId.charCodeAt(userId.length - 1);
    return lastChar % 2 === 0 ? 'A' : 'B';
  }

  async logComparison(data: {
    userId: string;
    action: string;
    predictionA: any;
    predictionB: any;
    selectedVariant: 'A' | 'B';
    isAnomaly: boolean;
    confidence: number;
  }) {
    const record = this.abTestRepository.create(data);
    return this.abTestRepository.save(record);
  }

  async getPerformanceMetrics() {
    // In a real implementation, this would aggregate stats
    const records = await this.abTestRepository.find({ take: 1000 });
    const stats = {
      variantA: { total: 0, anomalies: 0 },
      variantB: { total: 0, anomalies: 0 },
    };

    records.forEach(r => {
      const v = r.variant === 'A' ? stats.variantA : stats.variantB;
      v.total++;
      if (r.isAnomaly) v.anomalies++;
    });

    return stats;
  }
}
