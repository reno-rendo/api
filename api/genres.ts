// Vercel Serverless Function - Genres Endpoint
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
        const cached = getFromCache('genres');
        if (cached) {
            return res.status(200).json({
                success: true,
                data: cached,
                cache: { cached: true },
            });
        }

        const $ = await fetchPage(`${SOURCE_BASE_URL}/genre-list/`);

        const genres: any[] = [];
        $('.genres li a, .genre li a, .genrelist li a').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const name = $el.text().trim();
            const slug = href.split('/').filter(Boolean).pop() || '';

            if (slug && name) {
                genres.push({ slug, name });
            }
        });

        const data = {
            genres,
            total: genres.length,
        };

        // Cache for 1 hour
        setCache('genres', data, 3600);

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
                message: error.message || 'Failed to fetch genres',
            },
        });
    }
}
