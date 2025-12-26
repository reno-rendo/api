import { Request, Response } from 'express';
import { CheerioAPI } from 'cheerio';
import { scraperService } from '../utils/scraper.js';
import { cacheService } from '../services/cache.service.js';
import { generateCacheKey, getTTL } from '../config/cache.js';
import { SELECTORS, URL_PATTERNS } from '../config/selectors.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import { cleanText, extractSlug, ensureAbsoluteUrl, extractEpisodeNumber } from '../utils/helpers.js';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize.js';
import { SpotlightItem, LatestEpisodeItem } from '../types/anime.types.js';
import { ApiResponse } from '../types/common.types.js';

/**
 * Home page data structure
 */
interface HomeData {
    ongoing: SpotlightItem[];
    complete: SpotlightItem[];
    latestEpisodes: LatestEpisodeItem[];
}

type HomeResponse = ApiResponse<HomeData>;

/**
 * Parse ongoing/complete anime items from the page
 */
const parseAnimeList = ($: CheerioAPI, containerSelector: string): SpotlightItem[] => {
    const items: SpotlightItem[] = [];
    const selectors = SELECTORS.home.ongoing;

    $(containerSelector).each((_index, element) => {
        try {
            const $el = $(element);

            // Get link and extract slug
            const linkHref = $el.find(selectors.link).attr('href') || '';
            const slug = extractSlug(linkHref);

            if (!slug) return;

            // Get title
            const title = cleanText($el.find(selectors.title).text());
            if (!title) return;

            // Get thumbnail
            const thumbnailSrc = $el.find(selectors.thumbnail).attr('src') || '';
            const thumbnail = sanitizeUrl(ensureAbsoluteUrl(thumbnailSrc, env.SOURCE_BASE_URL));

            // Get episode info
            const episodeText = cleanText($el.find(selectors.episode).text());

            items.push({
                slug: sanitizeText(slug),
                title: sanitizeText(title),
                thumbnail,
                episode: episodeText || undefined,
            });
        } catch (error) {
            logger.warn('Failed to parse anime item', { error: (error as Error).message });
        }
    });

    return items;
};

/**
 * Parse latest episodes from the page
 */
const parseLatestEpisodes = ($: CheerioAPI): LatestEpisodeItem[] => {
    const items: LatestEpisodeItem[] = [];
    const selectors = SELECTORS.home.ongoing;

    // Latest episodes might be in a different section or same format
    // Try parsing from the ongoing section first
    $('.venz > ul > li').each((_index, element) => {
        try {
            const $el = $(element);

            // Get link to episode
            const linkHref = $el.find('.thumb a').attr('href') || '';
            const slug = extractSlug(linkHref);

            if (!slug) return;

            // Get title
            const title = cleanText($el.find('.jdlflm').text());
            if (!title) return;

            // Get thumbnail
            const thumbnailSrc = $el.find('.thumbz img').attr('src') || '';
            const thumbnail = sanitizeUrl(ensureAbsoluteUrl(thumbnailSrc, env.SOURCE_BASE_URL));

            // Get episode info
            const episodeText = cleanText($el.find('.epz').text());
            const episodeNum = extractEpisodeNumber(episodeText);

            // Get date
            const dateText = cleanText($el.find('.newnime').text());

            // Try to extract anime slug from episode slug
            // Episode slug usually contains anime name + episode number
            const animeSlug = slug.replace(/-episode-\d+.*$/, '').replace(/-ep-\d+.*$/, '');

            items.push({
                slug: sanitizeText(slug),
                animeSlug: sanitizeText(animeSlug),
                title: sanitizeText(title),
                episode: episodeNum || 0,
                thumbnail,
                releaseDate: dateText || undefined,
            });
        } catch (error) {
            logger.warn('Failed to parse episode item', { error: (error as Error).message });
        }
    });

    return items;
};

/**
 * GET /api/home
 * Fetch homepage data including ongoing, complete, and latest episodes
 */
export const getHome = async (_req: Request, res: Response): Promise<void> => {
    const cacheKey = generateCacheKey('home');
    const ttl = getTTL('home');

    // Check cache first
    const cached = await cacheService.get<HomeData>(cacheKey);
    if (cached) {
        const metadata = await cacheService.getMetadata(cacheKey);
        res.setHeader('X-Cache', 'HIT');

        const response: HomeResponse = {
            success: true,
            data: cached,
            cache: metadata,
        };
        res.json(response);
        return;
    }

    logger.info('Fetching home page from source');

    // Fetch and parse the home page
    const $ = await scraperService.fetch(URL_PATTERNS.home);

    // Parse ongoing anime (first section)
    const ongoingSection = $('.rapi').first().find('.venz > ul > li');
    const ongoing = parseAnimeList($, '.rapi:first .venz > ul > li');

    // Parse complete anime (if exists in second section)
    // Otakudesu might show ongoing and complete in different sections
    const complete: SpotlightItem[] = [];

    // Parse latest episodes
    const latestEpisodes = parseLatestEpisodes($);

    // If no data found, the selectors might have changed
    if (ongoing.length === 0 && latestEpisodes.length === 0) {
        logger.warn('No data found on home page - selectors may have changed');
        throw ApiError.scrapingError('Failed to parse home page data');
    }

    const data: HomeData = {
        ongoing,
        complete,
        latestEpisodes,
    };

    // Cache the result
    await cacheService.set(cacheKey, data, ttl);

    res.setHeader('X-Cache', 'MISS');

    const response: HomeResponse = {
        success: true,
        data,
        cache: {
            cached: false,
            expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        },
    };

    res.json(response);
};
