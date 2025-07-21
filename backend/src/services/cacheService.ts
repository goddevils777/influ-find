interface CacheItem {
  data: any;
  timestamp: number;
  expiresIn: number; // время жизни в миллисекундах
}

class CacheService {
  private cache: Map<string, CacheItem> = new Map();
  private readonly defaultTTL = 30 * 24 * 60 * 60 * 1000; // 30 дней

  set(key: string, data: any, ttl?: number): void {
    const expiresIn = ttl || this.defaultTTL;
    const cacheItem: CacheItem = {
      data,
      timestamp: Date.now(),
      expiresIn
    };
    
    this.cache.set(key, cacheItem);
    console.log(`Cache: Saved key "${key}" with TTL ${expiresIn}ms`);
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Проверяем не истек ли срок
    if (Date.now() - item.timestamp > item.expiresIn) {
      this.cache.delete(key);
      console.log(`Cache: Key "${key}" expired and removed`);
      return null;
    }
    
    console.log(`Cache: Hit for key "${key}"`);
    return item.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
    console.log('Cache: Cleared all entries');
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`Cache: Deleted key "${key}"`);
    }
    return deleted;
  }
}

export const cacheService = new CacheService();