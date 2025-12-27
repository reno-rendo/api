import { env, isTest } from './env';
import { logger } from '../utils/logger';

/**
 * Simple in-memory cache for serverless environments
 * Works on Vercel, Railway, Render, etc.
 */
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

/**
 * Clean expired entries from memory cache
 */
const cleanMemoryCache = (): void => {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
        if (entry.expiresAt < now) {
            memoryCache.delete(key);
        }
    }
};

// Clean memory cache periodically (only in long-running processes)
if (typeof setInterval !== 'undefined') {
    setInterval(cleanMemoryCache, 60000);
}

/**
 * Cache operations - pure in-memory, no external dependencies
 */
export const cacheOps = {
    async get(key: string): Promise<string | null> {
        const entry = memoryCache.get(key);
        if (entry && entry.expiresAt > Date.now()) {
            return entry.value;
        }
        memoryCache.delete(key);
        return null;
    },

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        memoryCache.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    },

    async del(key: string): Promise<void> {
        memoryCache.delete(key);
    },

    async ttl(key: string): Promise<number> {
        const entry = memoryCache.get(key);
        if (entry) {
            return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
        }
        return -1;
    },

    async ping(): Promise<boolean> {
        return true; // Memory cache is always available
    },

    async keys(pattern: string): Promise<string[]> {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(memoryCache.keys()).filter((key) => regex.test(key));
    },

    getStats(): { size: number; keys: string[] } {
        return {
            size: memoryCache.size,
            keys: Array.from(memoryCache.keys()),
        };
    },
};

/**
 * Check cache health
 */
export const pingCache = async (): Promise<boolean> => {
    return cacheOps.ping();
};

/**
 * Get cache stats
 */
export const getCacheStats = (): { size: number; keys: string[] } => {
    return cacheOps.getStats();
};
