import { Request, Response } from 'express';
import { scraperService } from '../utils/scraper';
import { cacheService } from '../services/cache.service';
import { generateCacheKey, getTTL } from '../config/cache';
import { URL_PATTERNS, SELECTORS } from '../config/selectors';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { cleanText } from '../utils/helpers';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize';
import { BatchInfo, ApiResponse } from '../types/common.types';

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $(selectors.download.container).each((_index: number, element: any) => {
        try {
            const $section = $(element);
            const quality = cleanText($section.find(selectors.download.quality).text());

            const links: { host: string; url: string }[] = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            $section.find(selectors.download.links).each((_i: number, linkEl: any) => {
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
