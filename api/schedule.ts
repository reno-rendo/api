// Vercel Serverless Function - Schedule Endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import * as cheerio from 'cheerio';

const SOURCE_BASE_URL = 'https://otakudesu.best';

// Simple in-memory cache
const cache = new Map<string, { data: any; expiresAt: number }>();

function getFromCache(key: string) {
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
        return entry.data;
    }
    cache.delete(key);
    return null;
}

function setCache(key: string, data: any, ttlSeconds: number) {
    cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function fetchPage(url: string) {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Referer': SOURCE_BASE_URL,
        },
        timeout: 15000,
    });
    return cheerio.load(response.data);
}

const dayMap: Record<string, string> = {
    senin: 'monday',
    selasa: 'tuesday',
    rabu: 'wednesday',
    kamis: 'thursday',
    jumat: 'friday',
    sabtu: 'saturday',
    minggu: 'sunday',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const dayFilter = (req.query.day as string)?.toLowerCase() || 'all';

        // Check cache
        const cacheKey = `schedule_${dayFilter}`;
        const cached = getFromCache(cacheKey);
        if (cached) {
            return res.status(200).json({
                success: true,
                data: cached,
                cache: { cached: true },
            });
        }

        const $ = await fetchPage(`${SOURCE_BASE_URL}/jadwal-rilis/`);

        const schedule: any[] = [];
        let currentDay = '';
        let currentAnime: any[] = [];

        // Parse the page - jadwal uses h2 for days and li for anime links
        $('h2, .kglist321 li a').each((_, el) => {
            const $el = $(el);
            const tagName = el.tagName?.toLowerCase() || (el as any).name;

            if (tagName === 'h2') {
                // Save previous day's data
                if (currentDay && currentAnime.length > 0) {
                    const englishDay = dayMap[currentDay.toLowerCase()] || currentDay.toLowerCase();
                    if (dayFilter === 'all' || dayFilter === englishDay) {
                        schedule.push({
                            day: englishDay,
                            dayIndonesian: currentDay,
                            anime: [...currentAnime],
                        });
                    }
                }

                // Start new day
                currentDay = $el.text().trim();
                currentAnime = [];
            } else if (tagName === 'a') {
                const href = $el.attr('href') || '';
                const title = $el.text().trim();
                const slug = href.split('/anime/')[1]?.replace(/\/$/, '') || '';

                if (slug && title && href.includes('/anime/')) {
                    currentAnime.push({ slug, title, url: href });
                }
            }
        });

        // Don't forget the last day
        if (currentDay && currentAnime.length > 0) {
            const englishDay = dayMap[currentDay.toLowerCase()] || currentDay.toLowerCase();
            if (dayFilter === 'all' || dayFilter === englishDay) {
                schedule.push({
                    day: englishDay,
                    dayIndonesian: currentDay,
                    anime: [...currentAnime],
                });
            }
        }

        // Alternative parsing if above didn't work
        if (schedule.length === 0) {
            // Try different selectors
            const allDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

            allDays.forEach(day => {
                const anime: any[] = [];
                $(`h2:contains("${day}")`).nextUntil('h2').find('a').each((_, el) => {
                    const $el = $(el);
                    const href = $el.attr('href') || '';
                    const title = $el.text().trim();
                    const slug = href.split('/anime/')[1]?.replace(/\/$/, '') || '';

                    if (slug && title) {
                        anime.push({ slug, title, url: href });
                    }
                });

                const englishDay = dayMap[day.toLowerCase()];
                if (anime.length > 0 && (dayFilter === 'all' || dayFilter === englishDay)) {
                    schedule.push({
                        day: englishDay,
                        dayIndonesian: day,
                        anime,
                    });
                }
            });
        }

        const data = {
            schedule,
            totalDays: schedule.length,
            totalAnime: schedule.reduce((sum, d) => sum + d.anime.length, 0),
            lastUpdated: new Date().toISOString(),
        };

        // Cache for 30 minutes
        setCache(cacheKey, data, 1800);

        return res.status(200).json({
            success: true,
            data,
            cache: { cached: false },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'SCRAPING_ERROR',
                message: error.message || 'Failed to fetch schedule',
            },
        });
    }
}
