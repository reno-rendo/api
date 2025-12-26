import { Request, Response } from 'express';
import { scraperService } from '../utils/scraper.js';
import { cacheService } from '../services/cache.service.js';
import { generateCacheKey, getTTL } from '../config/cache.js';
import { URL_PATTERNS, SELECTORS } from '../config/selectors.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import { cleanText } from '../utils/helpers.js';
import { sanitizeText } from '../utils/sanitize.js';
import { ServerInfo } from '../types/common.types.js';
import { ApiResponse } from '../types/common.types.js';

/**
 * Servers response data
 */
interface ServersData {
    episodeSlug: string;
    episodeTitle: string;
    servers: ServerInfo[];
}

type ServersResponse = ApiResponse<ServersData>;

/**
 * GET /api/servers?epId={episodeSlug}
 * Get available streaming servers for an episode
 */
export const getServers = async (req: Request, res: Response): Promise<void> => {
    const epId = req.query.epId as string;

    if (!epId) {
        throw ApiError.badRequest('Episode ID (epId) is required');
    }

    const cacheKey = generateCacheKey('servers', epId);
    const ttl = getTTL('servers');

    // Check cache first
    const cached = await cacheService.get<ServersData>(cacheKey);
    if (cached) {
        const metadata = await cacheService.getMetadata(cacheKey);
        res.setHeader('X-Cache', 'HIT');

        const response: ServersResponse = {
            success: true,
            data: cached,
            cache: metadata,
        };
        res.json(response);
        return;
    }

    logger.info('Fetching servers', { epId });

    // Fetch episode page
    const $ = await scraperService.fetch(URL_PATTERNS.episode(epId));

    // Get episode title
    const episodeTitle = cleanText($(SELECTORS.episode.title).text());
    if (!episodeTitle) {
        throw ApiError.notFound('Episode');
    }

    const servers: ServerInfo[] = [];
    const selectors = SELECTORS.episode.mirrors;

    // Parse server/mirror list
    $(selectors.container).each((_index, element) => {
        try {
            const $el = $(element);
            const $link = $el.find('a');

            const serverName = cleanText($link.text());
            if (!serverName) return;

            // Extract server ID from data attributes or onclick
            const dataId = $link.attr('data-content') || $link.attr('data-video') || '';
            const onclick = $link.attr('onclick') || '';

            // Try to extract server ID
            let serverId = dataId;
            if (!serverId && onclick) {
                const match = onclick.match(/['"]([^'"]+)['"]/);
                serverId = match ? match[1] : '';
            }

            // If no ID, use index as fallback
            if (!serverId) {
                serverId = `server-${_index}`;
            }

            // Determine quality from server name
            let quality = '';
            if (serverName.toLowerCase().includes('1080')) quality = '1080p';
            else if (serverName.toLowerCase().includes('720')) quality = '720p';
            else if (serverName.toLowerCase().includes('480')) quality = '480p';
            else if (serverName.toLowerCase().includes('360')) quality = '360p';

            servers.push({
                name: sanitizeText(serverName),
                quality: quality || undefined,
                type: 'streaming',
                serverId: sanitizeText(serverId),
            });
        } catch (error) {
            logger.warn('Failed to parse server', { error: (error as Error).message });
        }
    });

    // Also try to find download links
    $(SELECTORS.episode.download.container).each((_index, element) => {
        try {
            const $el = $(element);
            const quality = cleanText($el.find('strong').text());

            $el.find('a').each((_i, linkEl) => {
                const $link = $(linkEl);
                const serverName = cleanText($link.text());
                const href = $link.attr('href') || '';

                if (serverName && href) {
                    servers.push({
                        name: sanitizeText(`${serverName} (Download)`),
                        quality: quality || undefined,
                        type: 'download',
                        serverId: sanitizeText(href),
                    });
                }
            });
        } catch (error) {
            // Skip invalid elements
        }
    });

    if (servers.length === 0) {
        logger.warn('No servers found for episode', { epId });
    }

    const data: ServersData = {
        episodeSlug: sanitizeText(epId),
        episodeTitle: sanitizeText(episodeTitle),
        servers,
    };

    // Cache the result
    await cacheService.set(cacheKey, data, ttl);

    res.setHeader('X-Cache', 'MISS');

    const response: ServersResponse = {
        success: true,
        data,
        cache: {
            cached: false,
            expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        },
    };

    res.json(response);
};
