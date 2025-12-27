import { Request, Response } from 'express';
import { scraperService } from '../utils/scraper';
import { cacheService } from '../services/cache.service';
import { generateCacheKey, getTTL } from '../config/cache';
import { URL_PATTERNS } from '../config/selectors';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { cleanText, extractSlug } from '../utils/helpers';
import { sanitizeText } from '../utils/sanitize';
import { Genre, ApiResponse } from '../types/common.types';

/**
 * Genres response data
 */
interface GenresData {
    genres: Genre[];
    total: number;
}

type GenresResponse = ApiResponse<GenresData>;

/**
 * GET /api/genres
 * Fetch list of all available genres
 */
export const getGenres = async (_req: Request, res: Response): Promise<void> => {
    const cacheKey = generateCacheKey('genres');
    const ttl = getTTL('genres');

    // Check cache first
    const cached = await cacheService.get<GenresData>(cacheKey);
    if (cached) {
        const metadata = await cacheService.getMetadata(cacheKey);
        res.setHeader('X-Cache', 'HIT');

        const response: GenresResponse = {
            success: true,
            data: cached,
            cache: metadata,
        };
        res.json(response);
        return;
    }

    logger.info('Fetching genres from source');

    // Fetch the genre list page
    const $ = await scraperService.fetch(URL_PATTERNS.genres);

    const genres: Genre[] = [];

    // Parse genre links from the page
    // Try multiple possible selectors
    const genreSelectors = [
        '.genres li a',
        '.genre li a',
        '.genrex li a',
        '.genrelist li a',
        'ul.genre li a',
        '.taxindex li a',
    ];

    let found = false;
    for (const selector of genreSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
            elements.each((_index, element) => {
                try {
                    const $el = $(element);
                    const href = $el.attr('href') || '';
                    const name = cleanText($el.text());

                    if (!name) return;

                    // Extract slug from href
                    const slug = extractSlug(href) || name.toLowerCase().replace(/\s+/g, '-');

                    genres.push({
                        slug: sanitizeText(slug),
                        name: sanitizeText(name),
                    });
                } catch (error) {
                    logger.warn('Failed to parse genre item', { error: (error as Error).message });
                }
            });
            found = true;
            break;
        }
    }

    // If no genres found with specific selectors, try to find any genre-like links
    if (!found || genres.length === 0) {
        // Look for links containing "genres" in URL
        $('a[href*="/genres/"]').each((_index, element) => {
            try {
                const $el = $(element);
                const href = $el.attr('href') || '';
                const name = cleanText($el.text());

                if (!name || name.length < 2) return;
                if (genres.some(g => g.name === name)) return; // Avoid duplicates

                const slug = extractSlug(href);
                if (!slug) return;

                genres.push({
                    slug: sanitizeText(slug),
                    name: sanitizeText(name),
                });
            } catch (error) {
                // Skip invalid elements
            }
        });
    }

    if (genres.length === 0) {
        logger.warn('No genres found - selectors may have changed');
        throw ApiError.scrapingError('Failed to parse genres data');
    }

    // Sort genres alphabetically
    genres.sort((a, b) => a.name.localeCompare(b.name));

    const data: GenresData = {
        genres,
        total: genres.length,
    };

    // Cache the result
    await cacheService.set(cacheKey, data, ttl);

    res.setHeader('X-Cache', 'MISS');

    const response: GenresResponse = {
        success: true,
        data,
        cache: {
            cached: false,
            expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        },
    };

    res.json(response);
};
