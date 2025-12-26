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
import { EpisodeListItem } from '../types/anime.types.js';
import { ApiResponse } from '../types/common.types.js';

/**
 * Episodes response data
 */
interface EpisodesData {
    animeSlug: string;
    animeTitle: string;
    episodes: EpisodeListItem[];
    totalEpisodes: number;
}

type EpisodesResponse = ApiResponse<EpisodesData>;

/**
 * GET /api/episodes/:slug
 * Get list of all episodes for an anime
 */
export const getEpisodes = async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params;

    if (!slug) {
        throw ApiError.badRequest('Anime slug is required');
    }

    const cacheKey = generateCacheKey('episodes', slug);
    const ttl = getTTL('episodes');

    // Check cache first
    const cached = await cacheService.get<EpisodesData>(cacheKey);
    if (cached) {
        const metadata = await cacheService.getMetadata(cacheKey);
        res.setHeader('X-Cache', 'HIT');

        const response: EpisodesResponse = {
            success: true,
            data: cached,
            cache: metadata,
        };
        res.json(response);
        return;
    }

    logger.info('Fetching episodes', { slug });

    // Fetch anime detail page (episodes are listed there)
    const $ = await scraperService.fetch(URL_PATTERNS.anime(slug));

    // Get anime title
    const animeTitle = cleanText($(SELECTORS.anime.title).text());
    if (!animeTitle) {
        throw ApiError.notFound('Anime');
    }

    const episodes: EpisodeListItem[] = [];

    // Parse episode list
    $(SELECTORS.anime.episodes.container).each((_index, element) => {
        try {
            const $el = $(element);
            const $link = $el.find('a');

            const href = $link.attr('href') || '';
            const episodeSlug = extractSlug(href);

            if (!episodeSlug) return;

            const title = cleanText($link.text());
            const dateText = cleanText($el.find('.zemark, span.date, .epsleft span').last().text());

            // Extract episode number
            const epMatch = title.match(/Episode\s*(\d+)/i) || episodeSlug.match(/episode-(\d+)/i);
            const episodeNum = epMatch ? parseInt(epMatch[1], 10) : 0;

            // Get thumbnail if available
            const thumbnailSrc = $el.find('img').attr('src') || '';
            const thumbnail = thumbnailSrc
                ? sanitizeUrl(ensureAbsoluteUrl(thumbnailSrc, env.SOURCE_BASE_URL))
                : undefined;

            episodes.push({
                episodeSlug: sanitizeText(episodeSlug),
                episode: episodeNum,
                title: sanitizeText(title),
                releaseDate: dateText || undefined,
                thumbnail,
            });
        } catch (error) {
            logger.warn('Failed to parse episode', { error: (error as Error).message });
        }
    });

    // Sort by episode number
    episodes.sort((a, b) => a.episode - b.episode);

    const data: EpisodesData = {
        animeSlug: sanitizeText(slug),
        animeTitle: sanitizeText(animeTitle),
        episodes,
        totalEpisodes: episodes.length,
    };

    // Cache the result
    await cacheService.set(cacheKey, data, ttl);

    res.setHeader('X-Cache', 'MISS');

    const response: EpisodesResponse = {
        success: true,
        data,
        cache: {
            cached: false,
            expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        },
    };

    res.json(response);
};
