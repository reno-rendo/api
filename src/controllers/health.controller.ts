import { Request, Response } from 'express';
import { cacheService } from '../services/cache.service.js';
import { scraperService } from '../utils/scraper.js';
import { HealthCheck } from '../types/common.types.js';

/**
 * Basic health check
 * GET /health
 */
export const basicHealth = (_req: Request, res: Response): void => {
    const health: HealthCheck = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    };

    res.json(health);
};

/**
 * Detailed health check with Redis and source website status
 * GET /health/detailed
 */
export const detailedHealth = async (_req: Request, res: Response): Promise<void> => {
    const checks: HealthCheck['checks'] = {
        api: { status: 'ok' },
        redis: { status: 'unknown' },
        source: { status: 'unknown' },
    };

    // Redis check
    try {
        const redisOk = await cacheService.ping();
        checks.redis = redisOk ? { status: 'ok' } : { status: 'error', message: 'Ping failed' };
    } catch (error) {
        checks.redis = { status: 'error', message: (error as Error).message };
    }

    // Source website check
    try {
        const start = Date.now();
        await scraperService.fetch('/');
        const responseTime = Date.now() - start;
        checks.source = { status: 'ok', responseTime };
    } catch (error) {
        checks.source = { status: 'error', message: (error as Error).message };
    }

    // Determine overall status
    const allOk = Object.values(checks).every((c) => c.status === 'ok');
    const anyError = Object.values(checks).some(
        (c) => c.status === 'error' && c !== checks.source
    );

    let status: HealthCheck['status'] = 'ok';
    if (anyError) {
        status = 'error';
    } else if (!allOk) {
        status = 'degraded';
    }

    const health: HealthCheck = {
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks,
    };

    res.status(status === 'ok' ? 200 : status === 'degraded' ? 200 : 503).json(health);
};
