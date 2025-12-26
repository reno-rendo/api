import { Request, Response } from 'express';
import { CheerioAPI } from 'cheerio';
import { scraperService } from '../utils/scraper.js';
import { cacheService } from '../services/cache.service.js';
import { generateCacheKey, getTTL } from '../config/cache.js';
import { URL_PATTERNS, SELECTORS } from '../config/selectors.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import { cleanText, extractSlug, ensureAbsoluteUrl, parseNumber } from '../utils/helpers.js';
import { sanitizeText, sanitizeUrl, sanitizeHtml } from '../utils/sanitize.js';
import { AnimeDetail, EpisodeListItem, AnimeType, AnimeStatus } from '../types/anime.types.js';
import { ApiResponse } from '../types/common.types.js';

type AnimeResponse = ApiResponse<AnimeDetail>;

/**
 * Extract info field value from info table
 */
const extractInfoValue = ($: CheerioAPI, label: string): string => {
    let value = '';

    $(SELECTORS.anime.infoTable).each((_i, el) => {
        const text = $(el).text();
        if (text.toLowerCase().includes(label.toLowerCase())) {
            // Get text after the colon
            const parts = text.split(':');
            if (parts.length > 1) {
                value = cleanText(parts.slice(1).join(':'));
            }
        }
    });

    return value;
};

/**
 * Parse anime type from string
 */
const parseAnimeType = (typeStr: string): AnimeType => {
    const normalized = typeStr.toLowerCase().trim();

    if (normalized.includes('movie')) return 'Movie';
    if (normalized.includes('ova')) return 'OVA';
    if (normalized.includes('ona')) return 'ONA';
    if (normalized.includes('special')) return 'Special';
    if (normalized.includes('music')) return 'Music';

    return 'TV';
};

/**
 * Parse anime status from string
 */
const parseAnimeStatus = (statusStr: string): AnimeStatus => {
    const normalized = statusStr.toLowerCase().trim();

    if (normalized.includes('ongoing') || normalized.includes('airing')) return 'Ongoing';
    if (normalized.includes('upcoming') || normalized.includes('coming')) return 'Upcoming';

    return 'Completed';
};

/**
 * Parse episode list from anime detail page
 */
const parseEpisodeList = ($: CheerioAPI): EpisodeListItem[] => {
    const episodes: EpisodeListItem[] = [];
    const selectors = SELECTORS.anime.episodes;

    $(selectors.container).each((_index, element) => {
        try {
            const $el = $(element);
            const $link = $el.find('a');

            const href = $link.attr('href') || '';
            const slug = extractSlug(href);

            if (!slug) return;

            const title = cleanText($link.text());
            const dateText = cleanText($el.find('.zemark, .epsleft .date, span').last().text());

            // Extract episode number from title or slug
            const epMatch = title.match(/Episode\s*(\d+)/i) || slug.match(/episode-(\d+)/i);
            const episodeNum = epMatch ? parseInt(epMatch[1], 10) : 0;

            episodes.push({
                episodeSlug: sanitizeText(slug),
                episode: episodeNum,
                title: sanitizeText(title),
                releaseDate: dateText || undefined,
            });
        } catch (error) {
            logger.warn('Failed to parse episode item', { error: (error as Error).message });
        }
    });

    // Sort by episode number (ascending)
    episodes.sort((a, b) => a.episode - b.episode);

    return episodes;
};

/**
 * GET /api/anime/:slug
 * Get detailed information about a specific anime
 */
export const getAnimeDetail = async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params;

    if (!slug) {
        throw ApiError.badRequest('Anime slug is required');
    }

    const cacheKey = generateCacheKey('anime', slug);
    const ttl = getTTL('anime');

    // Check cache first
    const cached = await cacheService.get<AnimeDetail>(cacheKey);
    if (cached) {
        const metadata = await cacheService.getMetadata(cacheKey);
        res.setHeader('X-Cache', 'HIT');

        const response: AnimeResponse = {
            success: true,
            data: cached,
            cache: metadata,
        };
        res.json(response);
        return;
    }

    logger.info('Fetching anime detail', { slug });

    // Fetch anime detail page
    const $ = await scraperService.fetch(URL_PATTERNS.anime(slug));

    const selectors = SELECTORS.anime;

    // Get title
    const title = cleanText($(selectors.title).text());
    if (!title) {
        throw ApiError.notFound('Anime');
    }

    // Get thumbnail
    const thumbnailSrc = $(selectors.thumbnail).attr('src') || '';
    const thumbnail = sanitizeUrl(ensureAbsoluteUrl(thumbnailSrc, env.SOURCE_BASE_URL));

    // Get synopsis
    const synopsisHtml = $(selectors.synopsis).html() || '';
    const synopsis = sanitizeHtml(synopsisHtml).replace(/<[^>]*>/g, ' ').trim();

    // Extract info fields
    const japaneseTitle = extractInfoValue($, 'japanese');
    const scoreStr = extractInfoValue($, 'skor');
    const typeStr = extractInfoValue($, 'tipe');
    const statusStr = extractInfoValue($, 'status');
    const totalEpisodesStr = extractInfoValue($, 'total episode');
    const duration = extractInfoValue($, 'durasi');
    const releaseDate = extractInfoValue($, 'tanggal rilis');
    const studio = extractInfoValue($, 'studio');
    const producerStr = extractInfoValue($, 'produser');

    // Parse genres
    const genres: string[] = [];
    $(selectors.info.genres).each((_i, el) => {
        const genre = cleanText($(el).text());
        if (genre) {
            genres.push(sanitizeText(genre));
        }
    });

    // Parse score
    const score = parseNumber(scoreStr);

    // Parse total episodes
    const totalEpisodes = parseNumber(totalEpisodesStr);

    // Parse producers
    const producers = producerStr
        ? producerStr.split(',').map(p => sanitizeText(p.trim())).filter(Boolean)
        : [];

    // Parse episode list
    const episodeList = parseEpisodeList($);

    const data: AnimeDetail = {
        slug: sanitizeText(slug),
        title: sanitizeText(title),
        alternativeTitles: {
            japanese: japaneseTitle ? sanitizeText(japaneseTitle) : undefined,
        },
        thumbnail,
        synopsis: sanitizeText(synopsis),
        score: score || undefined,
        status: parseAnimeStatus(statusStr),
        type: parseAnimeType(typeStr),
        totalEpisodes: totalEpisodes || episodeList.length || null,
        duration: duration ? sanitizeText(duration) : undefined,
        releaseDate: releaseDate ? sanitizeText(releaseDate) : undefined,
        studio: studio ? sanitizeText(studio) : undefined,
        producers: producers.length > 0 ? producers : undefined,
        genres,
        episodeList,
    };

    // Cache the result
    await cacheService.set(cacheKey, data, ttl);

    res.setHeader('X-Cache', 'MISS');

    const response: AnimeResponse = {
        success: true,
        data,
        cache: {
            cached: false,
            expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        },
    };

    res.json(response);
};
