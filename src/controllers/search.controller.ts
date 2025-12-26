import { Request, Response } from 'express';
import { scraperService } from '../utils/scraper.js';
import { cacheService } from '../services/cache.service.js';
import { generateCacheKey, getTTL } from '../config/cache.js';
import { URL_PATTERNS, SELECTORS } from '../config/selectors.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import { cleanText, extractSlug, ensureAbsoluteUrl } from '../utils/helpers.js';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize.js';
import { AnimeSearchResult } from '../types/anime.types.js';
import { ApiResponse } from '../types/common.types.js';

/**
 * Search response data
 */
interface SearchData {
    query: string;
    results: AnimeSearchResult[];
    total: number;
}

type SearchResponse = ApiResponse<SearchData>;

/**
 * GET /api/search?q={query}&limit={limit}
 * Search for anime by keyword
 */
export const searchAnime = async (req: Request, res: Response): Promise<void> => {
    const query = (req.query.q as string) || '';
    const limit = parseInt(req.query.limit as string, 10) || 20;

    if (!query || query.trim().length === 0) {
        throw ApiError.badRequest('Search query is required');
    }

    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = generateCacheKey('search', normalizedQuery, limit.toString());
    const ttl = getTTL('search');

    // Check cache first
    const cached = await cacheService.get<SearchData>(cacheKey);
    if (cached) {
        const metadata = await cacheService.getMetadata(cacheKey);
        res.setHeader('X-Cache', 'HIT');

        const response: SearchResponse = {
            success: true,
            data: cached,
            cache: metadata,
        };
        res.json(response);
        return;
    }

    logger.info('Searching anime', { query: normalizedQuery });

    // Fetch search results
    const $ = await scraperService.fetch(URL_PATTERNS.search(query));

    const results: AnimeSearchResult[] = [];
    const selectors = SELECTORS.search;

    // Parse search results
    $(selectors.container).each((_index, element) => {
        if (results.length >= limit) return false; // Stop if we have enough

        try {
            const $el = $(element);

            // Get link and extract slug
            const $link = $el.find(selectors.link);
            const href = $link.attr('href') || '';
            const slug = extractSlug(href);

            if (!slug) return;

            // Get title
            const title = cleanText($link.text());
            if (!title) return;

            // Get thumbnail
            const thumbnailSrc = $el.find(selectors.thumbnail).attr('src') || '';
            const thumbnail = sanitizeUrl(ensureAbsoluteUrl(thumbnailSrc, env.SOURCE_BASE_URL));

            // Get genres (might be in .set element)
            const genreText = cleanText($el.find(selectors.genres).first().text());
            const genres = genreText
                ? genreText.split(',').map(g => sanitizeText(g.trim())).filter(Boolean)
                : [];

            results.push({
                slug: sanitizeText(slug),
                title: sanitizeText(title),
                thumbnail,
                genres: genres.length > 0 ? genres : undefined,
            });
        } catch (error) {
            logger.warn('Failed to parse search result', { error: (error as Error).message });
        }
    });

    // If no results found with main selector, try alternative
    if (results.length === 0) {
        // Try alternative selector for search results
        $('ul.chivsrc li, .chivsrc li, .listupd article').each((_index, element) => {
            if (results.length >= limit) return false;

            try {
                const $el = $(element);
                const $link = $el.find('a').first();
                const href = $link.attr('href') || '';
                const slug = extractSlug(href);

                if (!slug) return;

                // Get title from h2 or link text
                const title = cleanText($el.find('h2').text()) || cleanText($link.text());
                if (!title) return;

                // Get thumbnail
                const thumbnailSrc = $el.find('img').attr('src') || '';
                const thumbnail = sanitizeUrl(ensureAbsoluteUrl(thumbnailSrc, env.SOURCE_BASE_URL));

                results.push({
                    slug: sanitizeText(slug),
                    title: sanitizeText(title),
                    thumbnail,
                });
            } catch (error) {
                // Skip invalid elements
            }
        });
    }

    const data: SearchData = {
        query: sanitizeText(query),
        results,
        total: results.length,
    };

    // Cache the result
    await cacheService.set(cacheKey, data, ttl);

    res.setHeader('X-Cache', 'MISS');

    const response: SearchResponse = {
        success: true,
        data,
        cache: {
            cached: false,
            expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        },
    };

    res.json(response);
};

/**
 * GET /api/search/suggest?q={query}
 * Get search suggestions/autocomplete
 */
export const searchSuggest = async (req: Request, res: Response): Promise<void> => {
    const query = (req.query.q as string) || '';

    if (!query || query.trim().length < 2) {
        throw ApiError.badRequest('Query must be at least 2 characters');
    }

    // Use search with lower limit for suggestions
    req.query.limit = '10';
    await searchAnime(req, res);
};
