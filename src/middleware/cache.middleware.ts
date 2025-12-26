import { Request, Response, NextFunction, RequestHandler } from 'express';
import { cacheService, CacheMetadata } from '../services/cache.service.js';
import { generateCacheKey, getTTL, cachePrefix } from '../config/cache.js';
import { logger } from '../utils/logger.js';

/**
 * Extended Response with cache info
 */
interface CacheResponse extends Response {
    cacheData?: {
        key: string;
        ttl: number;
    };
}

/**
 * Create cache middleware for a specific resource type
 */
export const cacheMiddleware = (
    resourceType: keyof typeof cachePrefix,
    keyGenerator?: (req: Request) => string[]
): RequestHandler => {
    return async (req: Request, res: CacheResponse, next: NextFunction): Promise<void> => {
        try {
            // Generate cache key
            const keyParams = keyGenerator ? keyGenerator(req) : [];
            const cacheKey = generateCacheKey(resourceType, ...keyParams);
            const ttl = getTTL(resourceType);

            // Try to get from cache
            const cached = await cacheService.get(cacheKey);

            if (cached !== null) {
                logger.debug('Cache hit', { key: cacheKey });

                // Add cache metadata
                const metadata = await cacheService.getMetadata(cacheKey);

                res.setHeader('X-Cache', 'HIT');
                res.json({
                    ...(cached as object),
                    cache: metadata,
                });
                return;
            }

            logger.debug('Cache miss', { key: cacheKey });
            res.setHeader('X-Cache', 'MISS');

            // Store cache info for later use
            res.cacheData = { key: cacheKey, ttl };

            // Override res.json to cache the response
            const originalJson = res.json.bind(res);
            res.json = (body: unknown): Response => {
                // Cache the response
                if (res.statusCode >= 200 && res.statusCode < 300 && res.cacheData) {
                    cacheService.set(res.cacheData.key, body, res.cacheData.ttl).catch((err) => {
                        logger.error('Failed to cache response', { error: (err as Error).message });
                    });
                }

                // Add cache metadata
                const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
                const metadata: CacheMetadata = {
                    cached: false,
                    expiresAt,
                };

                return originalJson({
                    ...(body as object),
                    cache: metadata,
                });
            };

            next();
        } catch (error) {
            logger.error('Cache middleware error', { error: (error as Error).message });
            next();
        }
    };
};

/**
 * Cache middleware for home endpoint
 */
export const homeCache = cacheMiddleware('home');

/**
 * Cache middleware for anime detail
 */
export const animeCache = cacheMiddleware('anime', (req) => [req.params.slug || '']);

/**
 * Cache middleware for episodes
 */
export const episodesCache = cacheMiddleware('episodes', (req) => [req.params.slug || '']);

/**
 * Cache middleware for servers
 */
export const serversCache = cacheMiddleware('servers', (req) => [
    (req.query.epId as string) || '',
]);

/**
 * Cache middleware for stream
 */
export const streamCache = cacheMiddleware('stream', (req) => [
    (req.query.epId as string) || '',
    (req.query.server as string) || '',
]);

/**
 * Cache middleware for search
 */
export const searchCache = cacheMiddleware('search', (req) => [
    (req.query.q as string) || '',
    (req.query.limit as string) || '20',
]);

/**
 * Cache middleware for genres
 */
export const genresCache = cacheMiddleware('genres');

/**
 * Cache middleware for schedule
 */
export const scheduleCache = cacheMiddleware('schedule', (req) => [
    (req.query.day as string) || 'all',
]);
