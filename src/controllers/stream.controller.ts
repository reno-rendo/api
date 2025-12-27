import { Request, Response } from 'express';
import { scraperService } from '../utils/scraper';
import { cacheService } from '../services/cache.service';
import { generateCacheKey, getTTL } from '../config/cache';
import { URL_PATTERNS, SELECTORS } from '../config/selectors';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize';
import { StreamInfo } from '../types/common.types';
import { ApiResponse } from '../types/common.types';

type StreamResponse = ApiResponse<StreamInfo>;

/**
 * Extract stream URL from iframe or embedded player
 */
const extractStreamUrl = (html: string): string | null => {
    // Try multiple patterns to extract video URL
    const patterns = [
        // Direct video source
        /sources:\s*\[\s*\{\s*file:\s*["']([^"']+)["']/i,
        /source\s+src=["']([^"']+)["']/i,
        /file:\s*["']([^"']+\.m3u8[^"']*)["']/i,
        /file:\s*["']([^"']+\.mp4[^"']*)["']/i,
        // Embed URLs
        /(?:iframe|embed)[^>]+src=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
};

/**
 * GET /api/stream?epId={episodeSlug}&server={serverId}
 * Get streaming URL for a specific server
 */
export const getStream = async (req: Request, res: Response): Promise<void> => {
    const epId = req.query.epId as string;
    const server = req.query.server as string;

    if (!epId) {
        throw ApiError.badRequest('Episode ID (epId) is required');
    }

    if (!server) {
        throw ApiError.badRequest('Server ID is required');
    }

    const cacheKey = generateCacheKey('stream', epId, server);
    const ttl = getTTL('stream');

    // Check cache first
    const cached = await cacheService.get<StreamInfo>(cacheKey);
    if (cached) {
        const metadata = await cacheService.getMetadata(cacheKey);
        res.setHeader('X-Cache', 'HIT');

        const response: StreamResponse = {
            success: true,
            data: cached,
            cache: metadata,
        };
        res.json(response);
        return;
    }

    logger.info('Fetching stream', { epId, server });

    // Fetch episode page
    const $ = await scraperService.fetch(URL_PATTERNS.episode(epId));

    // Find the player iframe
    const iframeSrc = $(SELECTORS.episode.player).attr('src');

    if (!iframeSrc) {
        // Try to find stream URL from page content
        const pageHtml = $.html();
        const streamUrl = extractStreamUrl(pageHtml);

        if (streamUrl) {
            const data: StreamInfo = {
                episodeSlug: sanitizeText(epId),
                serverName: sanitizeText(server),
                streamUrl: sanitizeUrl(streamUrl),
                headers: {
                    referer: env.SOURCE_BASE_URL,
                },
                expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
            };

            await cacheService.set(cacheKey, data, ttl);

            res.setHeader('X-Cache', 'MISS');
            const response: StreamResponse = {
                success: true,
                data,
                cache: {
                    cached: false,
                    expiresAt: data.expiresAt,
                },
            };
            res.json(response);
            return;
        }

        throw ApiError.scrapingError('Could not find stream URL');
    }

    // Fetch the iframe content to get actual stream URL
    try {
        const iframeHtml = await scraperService.fetchRaw(iframeSrc);
        const streamUrl = extractStreamUrl(iframeHtml);

        if (!streamUrl) {
            // Return iframe URL as fallback (client needs to handle embedding)
            const data: StreamInfo = {
                episodeSlug: sanitizeText(epId),
                serverName: sanitizeText(server),
                streamUrl: sanitizeUrl(iframeSrc),
                headers: {
                    referer: env.SOURCE_BASE_URL,
                },
                expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
            };

            await cacheService.set(cacheKey, data, ttl);

            res.setHeader('X-Cache', 'MISS');
            const response: StreamResponse = {
                success: true,
                data,
                cache: {
                    cached: false,
                    expiresAt: data.expiresAt,
                },
            };
            res.json(response);
            return;
        }

        const data: StreamInfo = {
            episodeSlug: sanitizeText(epId),
            serverName: sanitizeText(server),
            streamUrl: sanitizeUrl(streamUrl),
            headers: {
                referer: iframeSrc,
            },
            expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        };

        // Cache the result
        await cacheService.set(cacheKey, data, ttl);

        res.setHeader('X-Cache', 'MISS');

        const response: StreamResponse = {
            success: true,
            data,
            cache: {
                cached: false,
                expiresAt: data.expiresAt,
            },
        };

        res.json(response);
    } catch (error) {
        logger.error('Failed to extract stream URL', { error: (error as Error).message });

        // Return iframe URL as fallback
        const data: StreamInfo = {
            episodeSlug: sanitizeText(epId),
            serverName: sanitizeText(server),
            streamUrl: sanitizeUrl(iframeSrc),
            headers: {
                referer: env.SOURCE_BASE_URL,
            },
            expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        };

        await cacheService.set(cacheKey, data, ttl);

        res.setHeader('X-Cache', 'MISS');
        const response: StreamResponse = {
            success: true,
            data,
            cache: {
                cached: false,
                expiresAt: data.expiresAt,
            },
        };
        res.json(response);
    }
};
