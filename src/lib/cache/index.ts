import { db } from '../db';
import { apiCache } from '../db/schema';
import { eq, lt } from 'drizzle-orm';

/**
 * Simple LRU Cache for in-memory layer
 */
class LRUMap<K, V> {
  private map = new Map<K, { value: V; expiresAt: number }>();
  private maxSize: number;

  constructor(maxSize = 5000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs: number) {
    this.map.delete(key);
    if (this.map.size >= this.maxSize) {
      // Delete oldest entry
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: K) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}

// Default TTLs by data type (in milliseconds)
const TTL = {
  keywordData: 30 * 24 * 60 * 60 * 1000, // 30 days
  serpData: 7 * 24 * 60 * 60 * 1000, // 7 days
  trafficData: 14 * 24 * 60 * 60 * 1000, // 14 days
  aiAnalysis: 7 * 24 * 60 * 60 * 1000, // 7 days
  default: 24 * 60 * 60 * 1000, // 1 day
  memory: 5 * 60 * 1000, // 5 min for memory layer
};

const memoryCache = new LRUMap<string, unknown>(5000);

/**
 * Multi-layer cache: Memory (LRU) -> SQLite (api_cache table) -> API call
 */
export async function cacheGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number
): Promise<T> {
  // Layer 1: Memory cache
  const memHit = memoryCache.get(key) as T | undefined;
  if (memHit !== undefined) return memHit;

  // Layer 2: Database cache
  const dbHit = await getFromDB(key);
  if (dbHit !== null) {
    memoryCache.set(key, dbHit, TTL.memory);
    return dbHit as T;
  }

  // Layer 3: Fetch from source
  const data = await fetcher();

  // Write to both layers
  const resolvedTtl = ttlMs ?? getTTLForKey(key);
  memoryCache.set(key, data, TTL.memory);
  await setInDB(key, data, resolvedTtl);

  return data;
}

/**
 * Invalidate a cache entry
 */
export async function cacheInvalidate(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    await db.delete(apiCache).where(eq(apiCache.cacheKey, key));
  } catch {
    // ignore
  }
}

/**
 * Clean expired entries from DB cache
 */
export async function cacheCleanup(): Promise<number> {
  try {
    const now = new Date().toISOString();
    const result = await db.delete(apiCache).where(lt(apiCache.expiresAt, now));
    return result.changes ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Build cache keys for different API calls
 */
export const CacheKeys = {
  keywordData: (keyword: string) => `dataforseo:keyword:${keyword}`,
  keywordBatch: (hash: string) => `dataforseo:batch:${hash}`,
  serpResults: (keyword: string) => `serp:${keyword}`,
  relatedKeywords: (seed: string) => `dataforseo:related:${seed}`,
  competitorData: (domain: string) => `competitor:${domain}`,
};

// Internal helpers

function getTTLForKey(key: string): number {
  if (key.startsWith('dataforseo:keyword:')) return TTL.keywordData;
  if (key.startsWith('serp:')) return TTL.serpData;
  if (key.startsWith('competitor:')) return TTL.trafficData;
  if (key.startsWith('ai:')) return TTL.aiAnalysis;
  return TTL.default;
}

async function getFromDB(key: string): Promise<unknown | null> {
  try {
    const result = await db.query.apiCache.findFirst({
      where: eq(apiCache.cacheKey, key),
    });
    if (!result) return null;

    // Check expiry
    if (new Date(result.expiresAt) < new Date()) {
      // Expired — delete async, return null
      db.delete(apiCache).where(eq(apiCache.cacheKey, key)).catch(() => {});
      return null;
    }

    return JSON.parse(result.response);
  } catch {
    return null;
  }
}

async function setInDB(key: string, data: unknown, ttlMs: number): Promise<void> {
  const apiName = key.split(':')[0];
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const response = JSON.stringify(data);

  try {
    // Upsert: delete then insert (SQLite doesn't have great ON CONFLICT for all versions)
    await db.delete(apiCache).where(eq(apiCache.cacheKey, key));
    await db.insert(apiCache).values({
      cacheKey: key,
      apiName,
      response,
      expiresAt,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[Cache] Failed to write to DB:', error);
  }
}
