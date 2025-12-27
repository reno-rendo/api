import { Request, Response } from 'express';
import { scraperService } from '../utils/scraper';
import { cacheService } from '../services/cache.service';
import { generateCacheKey, getTTL } from '../config/cache';
import { URL_PATTERNS, SELECTORS } from '../config/selectors';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { cleanText, extractSlug } from '../utils/helpers';
import { sanitizeText } from '../utils/sanitize';
import { ScheduleItem, ApiResponse } from '../types/common.types';

/**
 * Schedule response data
 */
interface ScheduleData {
    schedule: ScheduleItem[];
    lastUpdated: string;
}

type ScheduleResponse = ApiResponse<ScheduleData>;

/**
 * Day name mappings
 */
const dayMap: Record<string, ScheduleItem['day']> = {
    senin: 'monday',
    selasa: 'tuesday',
    rabu: 'wednesday',
    kamis: 'thursday',
    jumat: 'friday',
    sabtu: 'saturday',
    minggu: 'sunday',
    monday: 'monday',
    tuesday: 'tuesday',
    wednesday: 'wednesday',
    thursday: 'thursday',
    friday: 'friday',
    saturday: 'saturday',
    sunday: 'sunday',
};

/**
 * GET /api/schedule?day={day}
 * Get anime release schedule
 */
export const getSchedule = async (req: Request, res: Response): Promise<void> => {
    const dayParam = (req.query.day as string)?.toLowerCase() || 'all';
    const cacheKey = generateCacheKey('schedule', dayParam);
    const ttl = getTTL('schedule');

    // Check cache first
    const cached = await cacheService.get<ScheduleData>(cacheKey);
    if (cached) {
        const metadata = await cacheService.getMetadata(cacheKey);
        res.setHeader('X-Cache', 'HIT');

        const response: ScheduleResponse = {
            success: true,
            data: cached,
            cache: metadata,
        };
        res.json(response);
        return;
    }

    logger.info('Fetching schedule from source', { day: dayParam });

    // Fetch schedule page
    const $ = await scraperService.fetch(URL_PATTERNS.schedule);

    const schedule: ScheduleItem[] = [];
    const selectors = SELECTORS.schedule;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $(selectors.dayContainer).each((_index: number, element: any) => {
        try {
            const $day = $(element);
            const dayHeader = cleanText($day.find(selectors.dayHeader).text()).toLowerCase();

            // Map to English day name
            const day = dayMap[dayHeader];
            if (!day) return;

            // If filtering by day, skip non-matching days
            if (dayParam !== 'all' && dayParam !== day) return;

            const animeList: ScheduleItem['anime'] = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            $day.find(selectors.anime.container).each((_i: number, animeEl: any) => {
                try {
                    const $anime = $(animeEl);
                    const $link = $anime.find('a');

                    const href = $link.attr('href') || '';
                    const slug = extractSlug(href);
                    if (!slug) return;

                    const title = cleanText($link.text());
                    if (!title) return;

                    animeList.push({
                        slug: sanitizeText(slug),
                        title: sanitizeText(title),
                        thumbnail: '',
                    });
                } catch {
                    // Skip invalid items
                }
            });

            if (animeList.length > 0) {
                schedule.push({
                    day,
                    anime: animeList,
                });
            }
        } catch (error) {
            logger.warn('Failed to parse schedule day', { error: (error as Error).message });
        }
    });

    // Sort by day order
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    schedule.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

    const data: ScheduleData = {
        schedule,
        lastUpdated: new Date().toISOString(),
    };

    // Cache the result
    await cacheService.set(cacheKey, data, ttl);

    res.setHeader('X-Cache', 'MISS');

    const response: ScheduleResponse = {
        success: true,
        data,
        cache: {
            cached: false,
            expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        },
    };

    res.json(response);
};
