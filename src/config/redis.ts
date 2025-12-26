import { createClient, RedisClientType } from 'redis';
import { env, isTest } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Redis client singleton
 */
let redisClient: RedisClientType | null = null;
let redisAvailable = false;

/**
 * In-memory cache fallback when Redis is not available
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

// Clean memory cache periodically
setInterval(cleanMemoryCache, 60000);

/**
 * Get or create Redis client
 */
export const getRedisClient = async (): Promise<RedisClientType | null> => {
    // Skip Redis in test mode
    if (isTest) {
        return null;
    }

    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    // If we already tried and failed, return null
    if (redisAvailable === false && redisClient === null) {
        return null;
    }

    try {
        const client = createClient({
            socket: {
                host: env.REDIS_HOST,
                port: env.REDIS_PORT,
                connectTimeout: 5000,
            },
            password: env.REDIS_PASSWORD || undefined,
            database: env.REDIS_DB,
        });

        client.on('error', (err) => {
            if (redisAvailable) {
                logger.error('Redis Client Error', { error: err.message });
                redisAvailable = false;
            }
        });

        client.on('connect', () => {
            logger.info('Redis connected', { host: env.REDIS_HOST, port: env.REDIS_PORT });
            redisAvailable = true;
        });

        client.on('reconnecting', () => {
            logger.warn('Redis reconnecting...');
        });

        await client.connect();
        redisClient = client as RedisClientType;
        redisAvailable = true;

        return redisClient;
    } catch (error) {
        logger.warn('Redis not available, using in-memory cache', {
            error: (error as Error).message,
        });
        redisAvailable = false;
        return null;
    }
};

/**
 * Check if Redis is available
 */
export const isRedisAvailable = (): boolean => redisAvailable;

/**
 * Close Redis connection
 */
export const closeRedisConnection = async (): Promise<void> => {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        redisClient = null;
        redisAvailable = false;
        logger.info('Redis connection closed');
    }
};

/**
 * Unified cache operations (Redis with memory fallback)
 */
export const cacheOps = {
    async get(key: string): Promise<string | null> {
        const redis = await getRedisClient();

        if (redis) {
            try {
                return await redis.get(key);
            } catch (error) {
                logger.warn('Redis get failed, using memory cache', { key });
            }
        }

        // Fallback to memory cache
        const entry = memoryCache.get(key);
        if (entry && entry.expiresAt > Date.now()) {
            return entry.value;
        }
        memoryCache.delete(key);
        return null;
    },

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        const redis = await getRedisClient();

        if (redis) {
            try {
                await redis.setEx(key, ttlSeconds, value);
                return;
            } catch (error) {
                logger.warn('Redis set failed, using memory cache', { key });
            }
        }

        // Fallback to memory cache
        memoryCache.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    },

    async del(key: string): Promise<void> {
        const redis = await getRedisClient();

        if (redis) {
            try {
                await redis.del(key);
            } catch {
                // Ignore
            }
        }

        memoryCache.delete(key);
    },

    async ttl(key: string): Promise<number> {
        const redis = await getRedisClient();

        if (redis) {
            try {
                return await redis.ttl(key);
            } catch {
                // Ignore
            }
        }

        // Fallback to memory cache
        const entry = memoryCache.get(key);
        if (entry) {
            return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
        }
        return -1;
    },

    async ping(): Promise<boolean> {
        const redis = await getRedisClient();

        if (redis) {
            try {
                const result = await redis.ping();
                return result === 'PONG';
            } catch {
                return false;
            }
        }

        // Memory cache is always available
        return true;
    },

    async keys(pattern: string): Promise<string[]> {
        const redis = await getRedisClient();

        if (redis) {
            try {
                return await redis.keys(pattern);
            } catch {
                // Ignore
            }
        }

        // Fallback - simple pattern matching for memory cache
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(memoryCache.keys()).filter((key) => regex.test(key));
    },
};

/**
 * Check Redis health
 */
export const pingRedis = async (): Promise<boolean> => {
    return cacheOps.ping();
};
