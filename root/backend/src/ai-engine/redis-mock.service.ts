import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisMockService {
  private store: Map<string, any[]> = new Map();

  async lpush(key: string, value: string) {
    if (!this.store.has(key)) {
      this.store.set(key, []);
    }
    const list = this.store.get(key);
    list.unshift(JSON.parse(value)); // Add to front
    this.store.set(key, list);
  }

  async ltrim(key: string, start: number, stop: number) {
    if (this.store.has(key)) {
      const list = this.store.get(key);
      // Keep only elements within the range [start, stop]
      // In Redis LTRIM, stop is inclusive. Slice is exclusive for end.
      const trimmed = list.slice(start, stop + 1); 
      this.store.set(key, trimmed);
    }
  }

  async lrange(key: string, start: number, stop: number) {
    if (!this.store.has(key)) return [];
    const list = this.store.get(key);
    // Handle -1 (end of list)
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  // Helper for simulation to clear state
  async flushall() {
    this.store.clear();
  }
}
