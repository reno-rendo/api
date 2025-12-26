import { Request, Response } from 'express';
import { scraperService } from '../utils/scraper.js';
import { cacheService } from '../services/cache.service.js';
import { generateCacheKey, getTTL } from '../config/cache.js';
import { URL_PATTERNS, SELECTORS } from '../config/selectors.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import { cleanText } from '../utils/helpers.js';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize.js';
import { BatchInfo, ApiResponse } from '../types/common.types.js';

type BatchResponse = ApiResponse<BatchInfo>;

/**
 * GET /api/batch/:slug
 * Get batch download links for an anime
 */
export const getBatch = async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params;

    if (!slug) {
        throw ApiError.badRequest('Batch slug is required');
    }

    const cacheKey = generateCacheKey('batch', slug);
    const ttl = getTTL('batch');

    // Check cache first
    const cached = await cacheService.get<BatchInfo>(cacheKey);
    if (cached) {
        const metadata = await cacheService.getMetadata(cacheKey);
        res.setHeader('X-Cache', 'HIT');

        const response: BatchResponse = {
            success: true,
            data: cached,
            cache: metadata,
        };
        res.json(response);
        return;
    }

    logger.info('Fetching batch download', { slug });

    // Fetch batch page
    const $ = await scraperService.fetch(URL_PATTERNS.batch(slug));

    const selectors = SELECTORS.batch;

    // Get title
    const title = cleanText($(selectors.title).text());
    if (!title) {
        throw ApiError.notFound('Batch');
    }

    const batchLinks: BatchInfo['batchLinks'] = [];

    // Parse download sections
    $(selectors.download.container).each((_index: number, element: unknown) => {
        try {
            const $section = $(element);
            const quality = cleanText($section.find(selectors.download.quality).text());

            const links: { host: string; url: string }[] = [];

            $section.find(selectors.download.links).each((_i: number, linkEl: unknown) => {
                const $link = $(linkEl);
                const host = cleanText($link.text());
                const url = $link.attr('href') || '';

                if (host && url) {
                    links.push({
                        host: sanitizeText(host),
                        url: sanitizeUrl(url),
                    });
                }
            });

            // Get size if available
            const sizeText = cleanText($section.find(selectors.download.size).text());

            if (links.length > 0) {
                batchLinks.push({
                    quality: sanitizeText(quality) || 'Unknown',
                    size: sizeText || undefined,
                    links,
                });
            }
        } catch (error) {
            logger.warn('Failed to parse batch link', { error: (error as Error).message });
        }
    });

    const data: BatchInfo = {
        animeSlug: sanitizeText(slug),
        animeTitle: sanitizeText(title),
        batchLinks,
    };

    // Cache the result
    await cacheService.set(cacheKey, data, ttl);

    res.setHeader('X-Cache', 'MISS');

    const response: BatchResponse = {
        success: true,
        data,
        cache: {
            cached: false,
            expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        },
    };

    res.json(response);
};
