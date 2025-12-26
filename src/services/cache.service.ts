import { cacheOps, isRedisAvailable } from '../config/redis.js';
import { generateCacheKey, getTTL } from '../config/cache.js';
import { logger } from '../utils/logger.js';

/**
 * Cache metadata added to responses
 */
export interface CacheMetadata {
    cached: boolean;
    expiresAt: string | null;
    source: 'redis' | 'memory';
}

/**
 * Cache Service - Unified cache wrapper (Redis with memory fallback)
 */
export class CacheService {
    /**
     * Get cached data by key
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await cacheOps.get(key);

            if (data) {
                logger.debug('Cache hit', { key, source: isRedisAvailable() ? 'redis' : 'memory' });
                return JSON.parse(data) as T;
            }

            logger.debug('Cache miss', { key });
            return null;
        } catch (error) {
            logger.error('Cache get error', { key, error: (error as Error).message });
            return null;
        }
    }

    /**
     * Set data in cache with TTL
     */
    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
        try {
            await cacheOps.set(key, JSON.stringify(value), ttlSeconds);
            logger.debug('Cache set', { key, ttl: ttlSeconds, source: isRedisAvailable() ? 'redis' : 'memory' });
        } catch (error) {
            logger.error('Cache set error', { key, error: (error as Error).message });
        }
    }

    /**
     * Delete cached data by key
     */
    async delete(key: string): Promise<void> {
        try {
            await cacheOps.del(key);
            logger.debug('Cache deleted', { key });
        } catch (error) {
            logger.error('Cache delete error', { key, error: (error as Error).message });
        }
    }

    /**
     * Delete all keys matching a pattern
     */
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

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<boolean> {
        try {
            const data = await cacheOps.get(key);
            return data !== null;
        } catch (error) {
            logger.error('Cache exists error', { key, error: (error as Error).message });
            return false;
        }
    }

    /**
     * Get TTL of a key
     */
    async getTTL(key: string): Promise<number> {
        try {
            return await cacheOps.ttl(key);
        } catch (error) {
            logger.error('Cache TTL error', { key, error: (error as Error).message });
            return -1;
        }
    }

    /**
     * Get or set pattern - fetch from cache or execute function
     */
    async getOrSet<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttlSeconds: number
    ): Promise<{ data: T; cached: boolean }> {
        // Try to get from cache first
        const cached = await this.get<T>(key);
        if (cached !== null) {
            return { data: cached, cached: true };
        }

        // Fetch fresh data
        const data = await fetchFn();

        // Store in cache
        await this.set(key, data, ttlSeconds);

        return { data, cached: false };
    }

    /**
     * Generate cache metadata for response
     */
    async getMetadata(key: string): Promise<CacheMetadata> {
        const ttl = await this.getTTL(key);
        const expiresAt = ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null;

        return {
            cached: ttl > 0,
            expiresAt,
            source: isRedisAvailable() ? 'redis' : 'memory',
        };
    }

    /**
     * Ping cache to check connection
     */
    async ping(): Promise<boolean> {
        return cacheOps.ping();
    }
}

/**
 * Singleton cache service instance
 */
export const cacheService = new CacheService();

/**
 * Helper functions for common cache operations
 */
export const cache = {
    /**
     * Get homepage cache
     */
    home: {
        get: () => cacheService.get(generateCacheKey('home')),
        set: <T>(data: T) => cacheService.set(generateCacheKey('home'), data, getTTL('home')),
    },

    /**
     * Get anime cache
     */
    anime: {
        get: <T>(slug: string) => cacheService.get<T>(generateCacheKey('anime', slug)),
        set: <T>(slug: string, data: T) =>
            cacheService.set(generateCacheKey('anime', slug), data, getTTL('anime')),
    },

    /**
     * Get search cache
     */
    search: {
        get: <T>(query: string, limit: number) =>
            cacheService.get<T>(generateCacheKey('search', query, limit.toString())),
        set: <T>(query: string, limit: number, data: T) =>
            cacheService.set(generateCacheKey('search', query, limit.toString()), data, getTTL('search')),
    },

    /**
     * Get genres cache
     */
    genres: {
        get: <T>() => cacheService.get<T>(generateCacheKey('genres')),
        set: <T>(data: T) => cacheService.set(generateCacheKey('genres'), data, getTTL('genres')),
    },
};
