// Vercel Serverless Function - Home Endpoint
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // Check cache
        const cached = getFromCache('home');
        if (cached) {
            return res.status(200).json({
                success: true,
                data: cached,
                cache: { cached: true },
            });
        }

        const $ = await fetchPage(SOURCE_BASE_URL);

        // Parse ongoing anime
        const ongoing: any[] = [];
        $('.venz ul li').each((_, el) => {
            const $item = $(el);
            const $link = $item.find('.thumb a');
            const href = $link.attr('href') || '';
            const slug = href.split('/').filter(Boolean).pop() || '';
            const title = $item.find('.jdlflm').text().trim();
            const thumbnail = $item.find('.thumb img').attr('src') || '';
            const episode = $item.find('.epz').text().trim();

            if (slug && title) {
                ongoing.push({ slug, title, thumbnail, episode });
            }
        });

        // Parse latest episodes  
        const latestEpisodes: any[] = [];
        $('.rseries ul li').each((_, el) => {
            const $item = $(el);
            const $link = $item.find('a');
            const href = $link.attr('href') || '';
            const slug = href.split('/').filter(Boolean).pop() || '';
            const title = $item.find('.jdlflm').text().trim() || $link.text().trim();
            const thumbnail = $item.find('img').attr('src') || '';

            if (slug && title) {
                latestEpisodes.push({ slug, title, thumbnail });
            }
        });

        const data = {
            ongoing: ongoing.slice(0, 20),
            latestEpisodes: latestEpisodes.slice(0, 20),
            lastUpdated: new Date().toISOString(),
        };

        // Cache for 5 minutes
        setCache('home', data, 300);

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
                message: error.message || 'Failed to fetch home data',
            },
        });
    }
}
