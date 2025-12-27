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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
        },
        timeout: 10000,
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

        // Try multiple selectors for schedule
        $('.kglist, .schedulepage, .jadwal').each((_, section) => {
            const $section = $(section);
            const dayText = $section.find('h2, h3, .day').text().toLowerCase().trim();
            const day = dayMap[dayText] || dayText;

            if (dayFilter !== 'all' && day !== dayFilter) return;

            const anime: any[] = [];
            $section.find('ul li a, .items a').each((_, el) => {
                const $el = $(el);
                const href = $el.attr('href') || '';
                const title = $el.text().trim();
                const slug = href.split('/').filter(Boolean).pop() || '';

                if (slug && title) {
                    anime.push({ slug, title });
                }
            });

            if (anime.length > 0) {
                schedule.push({ day, anime });
            }
        });

        const data = {
            schedule,
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
