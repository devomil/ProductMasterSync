// Optimized in-memory query cache for million+ product scale
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 30000;
  private readonly MAX_CACHE_SIZE = 10000;
  private readonly CLEANUP_BATCH_SIZE = 1000;
  private hits = 0;
  private misses = 0;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    
    const now = Date.now();
    
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    entry.accessCount++;
    entry.lastAccessed = now;
    this.hits++;
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    
    // Enforce cache size limit with LRU eviction
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastRecentlyUsed();
    }
    
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: ttl || this.DEFAULT_TTL,
      accessCount: 1,
      lastAccessed: now
    });
  }

  // LRU eviction policy for memory efficiency with millions of products
  private evictLeastRecentlyUsed(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed time (oldest first) and access count
    entries.sort((a, b) => {
      const aEntry = a[1];
      const bEntry = b[1];
      
      // First sort by last accessed time, then by access count
      if (aEntry.lastAccessed !== bEntry.lastAccessed) {
        return aEntry.lastAccessed - bEntry.lastAccessed;
      }
      return aEntry.accessCount - bEntry.accessCount;
    });
    
    // Remove oldest entries (25% of cache)
    const entriesToRemove = Math.min(this.CLEANUP_BATCH_SIZE, Math.floor(this.cache.size * 0.25));
    for (let i = 0; i < entriesToRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  // Clean expired entries periodically to free memory
  cleanExpired(): number {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Convert to array first to avoid TypeScript iterator issues
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  invalidate(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): {
    size: number;
    maxSize: number;
    memoryUsage: string;
    hits: number;
    misses: number;
    hitRate: string;
  } {
    const estimatedMemoryPerEntry = 1024;
    const estimatedMemoryUsage = this.cache.size * estimatedMemoryPerEntry;
    const total = this.hits + this.misses;
    
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      memoryUsage: `${(estimatedMemoryUsage / 1024 / 1024).toFixed(2)} MB`,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : '0%'
    };
  }
}

export const queryCache = new QueryCache();