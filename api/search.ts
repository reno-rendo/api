// Vercel Serverless Function - Search Endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import * as cheerio from 'cheerio';

const SOURCE_BASE_URL = 'https://otakudesu.best';

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
        const query = req.query.q as string;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Query parameter "q" is required',
                },
            });
        }

        const searchUrl = `${SOURCE_BASE_URL}/?s=${encodeURIComponent(query)}&post_type=anime`;
        const $ = await fetchPage(searchUrl);

        const results: any[] = [];
        $('.chi_anime, .vemark, .page ul li, article').each((_, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href') || '';
            const title = $el.find('h2, .title, .jdlflm').text().trim() || $link.text().trim();
            const thumbnail = $el.find('img').attr('src') || '';
            const slug = href.split('/').filter(Boolean).pop() || '';

            if (slug && title && href.includes('anime')) {
                results.push({ slug, title, thumbnail, url: href });
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                query,
                results: results.slice(0, 20),
                total: results.length,
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'SCRAPING_ERROR',
                message: error.message || 'Search failed',
            },
        });
    }
}
