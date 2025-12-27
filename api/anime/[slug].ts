// Vercel Serverless Function - Anime Detail Endpoint
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
        const { slug } = req.query;

        if (!slug || typeof slug !== 'string') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Anime slug is required',
                },
            });
        }

        const $ = await fetchPage(`${SOURCE_BASE_URL}/anime/${slug}/`);

        // Extract anime details
        const title = $('.infozingle span:contains("Judul") b, .infozin span b').first().parent().text().replace('Judul:', '').trim()
            || $('h1.jdlrx, h1.entry-title').text().trim();

        if (!title) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Anime not found',
                },
            });
        }

        const thumbnail = $('.fotoanime img, .thumb img').attr('src') || '';
        const synopsis = $('.sinopc p, .sinopsis p').text().trim();

        // Extract info fields
        const info: Record<string, string> = {};
        $('.infozingle span, .infozin span').each((_, el) => {
            const text = $(el).text();
            const [key, ...values] = text.split(':');
            if (key && values.length) {
                info[key.trim().toLowerCase()] = values.join(':').trim();
            }
        });

        // Extract episodes
        const episodes: any[] = [];
        $('.episodelist ul li a, .epslst ul li a').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const epTitle = $el.text().trim();
            const epSlug = href.split('/').filter(Boolean).pop() || '';

            if (epSlug && epTitle) {
                episodes.push({ slug: epSlug, title: epTitle, url: href });
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                slug,
                title,
                thumbnail,
                synopsis,
                info,
                episodes: episodes.reverse(), // Oldest first
                totalEpisodes: episodes.length,
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'SCRAPING_ERROR',
                message: error.message || 'Failed to fetch anime details',
            },
        });
    }
}
