import { Request, Response } from 'express';
import { cacheService } from '../services/cache.service';
import { scraperService } from '../utils/scraper';
import { getCacheStats } from '../config/redis';
import { HealthCheck } from '../types/common.types';

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
 * Detailed health check
 * GET /health/detailed
 */
export const detailedHealth = async (_req: Request, res: Response): Promise<void> => {
    const checks: HealthCheck['checks'] = {
        api: { status: 'ok' },
        cache: { status: 'ok' },
        source: { status: 'unknown' },
    };

    // Cache check (in-memory, always works)
    try {
        const cacheStats = getCacheStats();
        checks.cache = {
            status: 'ok',
            message: `${cacheStats.size} items cached`
        };
    } catch {
        checks.cache = { status: 'error', message: 'Cache unavailable' };
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
