import { Request, Response } from 'express';
import axios from 'axios';
import { env } from '../config/env';
import { proxyRateLimiter } from '../config/rate-limit';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';

/**
 * Allowed domains for proxy
 */
const ALLOWED_DOMAINS = [
    'otakudesu.best',
    'otakudesu.cloud',
    'stream.otakudesu.best',
    'cdn.otakudesu.best',
    'i.imgur.com',
    'img.youtube.com',
];

/**
 * Check if URL is from allowed domain
 */
const isAllowedDomain = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        return ALLOWED_DOMAINS.some(
            (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
};

/**
 * GET /api/proxy?url={encodedUrl}
 * Proxy requests to allowed domains
 */
export const proxyRequest = async (req: Request, res: Response): Promise<void> => {
    const url = req.query.url as string;

    if (!url) {
        throw ApiError.badRequest('URL parameter is required');
    }

    // Decode URL if needed
    let decodedUrl: string;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch {
        decodedUrl = url;
    }

    // Validate domain
    if (!isAllowedDomain(decodedUrl)) {
        throw ApiError.badRequest('Domain not allowed for proxy');
    }

    logger.debug('Proxying request', { url: decodedUrl });

    try {
        const response = await axios.get(decodedUrl, {
            timeout: 30000,
            responseType: 'stream',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Referer: env.SOURCE_BASE_URL,
                Accept: '*/*',
            },
        });

        // Forward relevant headers
        const contentType = response.headers['content-type'];
        const contentLength = response.headers['content-length'];

        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        // Cache control
        res.setHeader('Cache-Control', 'public, max-age=3600');

        // Stream the response
        response.data.pipe(res);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 404) {
                throw ApiError.notFound('Resource');
            }
            throw ApiError.scrapingError('Failed to proxy request', {
                status: error.response?.status,
                message: error.message,
            });
        }
        throw error;
    }
};

/**
 * Proxy middleware with rate limiting
 */
export const proxyMiddleware = [proxyRateLimiter];
