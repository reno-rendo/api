import { cacheOps } from '../config/redis.js';
import { generateCacheKey, getTTL } from '../config/cache.js';
import { logger } from '../utils/logger.js';

/**
 * Cache metadata added to responses
 */
export interface CacheMetadata {
    cached: boolean;
    expiresAt: string | null;
}

/**
 * Cache Service - Simple in-memory cache wrapper
 * Works on any platform: Vercel, Railway, Render, etc.
 */
export class CacheService {
    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await cacheOps.get(key);
            if (data) {
                logger.debug('Cache hit', { key });
                return JSON.parse(data) as T;
            }
            logger.debug('Cache miss', { key });
            return null;
        } catch (error) {
            logger.error('Cache get error', { key, error: (error as Error).message });
            return null;
        }
    }

    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
        try {
            await cacheOps.set(key, JSON.stringify(value), ttlSeconds);
            logger.debug('Cache set', { key, ttl: ttlSeconds });
        } catch (error) {
            logger.error('Cache set error', { key, error: (error as Error).message });
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await cacheOps.del(key);
            logger.debug('Cache deleted', { key });
        } catch (error) {
            logger.error('Cache delete error', { key, error: (error as Error).message });
        }
    }

    async invalidatePattern(pattern: string): Promise<number> {
        try {
            const keys = await cacheOps.keys(pattern);
            for (const key of keys) {
                await cacheOps.del(key);
            }
            if (keys.length > 0) {
                logger.info('Cache invalidated', { pattern, count: keys.length });
            }
            return keys.length;
        } catch (error) {
            logger.error('Cache invalidate error', { pattern, error: (error as Error).message });
            return 0;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const data = await cacheOps.get(key);
            return data !== null;
        } catch (error) {
            return false;
        }
    }

    async getTTL(key: string): Promise<number> {
        try {
            return await cacheOps.ttl(key);
        } catch (error) {
            return -1;
        }
    }

    async getOrSet<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttlSeconds: number
    ): Promise<{ data: T; cached: boolean }> {
        const cached = await this.get<T>(key);
        if (cached !== null) {
            return { data: cached, cached: true };
        }
        const data = await fetchFn();
        await this.set(key, data, ttlSeconds);
        return { data, cached: false };
    }

    async getMetadata(key: string): Promise<CacheMetadata> {
        const ttl = await this.getTTL(key);
        const expiresAt = ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null;
        return { cached: ttl > 0, expiresAt };
    }

    async ping(): Promise<boolean> {
        return cacheOps.ping();
    }
}

export const cacheService = new CacheService();
