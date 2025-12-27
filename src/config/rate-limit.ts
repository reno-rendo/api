import rateLimit from 'express-rate-limit';
import { env } from './env';

/**
 * Rate limit configuration per endpoint type
 */
export const rateLimitConfig = {
    /**
     * Global rate limit - applies to all endpoints
     * 1000 requests per 15 minutes
     */
    global: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        max: env.RATE_LIMIT_MAX,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later',
            },
        },
        keyGenerator: (req: { ip?: string }): string => req.ip || 'unknown',
    },

    /**
     * Search endpoint - more restrictive
     * 30 requests per minute
     */
    search: {
        windowMs: 60 * 1000,
        max: 30,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many search requests, please try again later',
            },
        },
        keyGenerator: (req: { ip?: string }): string => `search:${req.ip || 'unknown'}`,
    },

    /**
     * Stream endpoint - restrictive to prevent abuse
     * 20 requests per minute
     */
    stream: {
        windowMs: 60 * 1000,
        max: 20,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many stream requests, please try again later',
            },
        },
        keyGenerator: (req: { ip?: string }): string => `stream:${req.ip || 'unknown'}`,
    },

    /**
     * Proxy endpoint - most restrictive
     * 10 requests per minute
     */
    proxy: {
        windowMs: 60 * 1000,
        max: 10,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many proxy requests, please try again later',
            },
        },
        keyGenerator: (req: { ip?: string }): string => `proxy:${req.ip || 'unknown'}`,
    },
} as const;

/**
 * Create rate limiter middleware
 */
export const createRateLimiter = (type: keyof typeof rateLimitConfig): ReturnType<typeof rateLimit> => {
    return rateLimit(rateLimitConfig[type]);
};

/**
 * Global rate limiter instance
 */
export const globalRateLimiter = createRateLimiter('global');

/**
 * Search rate limiter instance
 */
export const searchRateLimiter = createRateLimiter('search');

/**
 * Stream rate limiter instance
 */
export const streamRateLimiter = createRateLimiter('stream');

/**
 * Proxy rate limiter instance
 */
export const proxyRateLimiter = createRateLimiter('proxy');
