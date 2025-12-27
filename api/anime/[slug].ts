// Vercel Serverless Function - Anime Detail Endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import * as cheerio from 'cheerio';

const SOURCE_BASE_URL = 'https://otakudesu.best';

// User agent rotation to avoid detection
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

async function fetchPage(url: string) {
    // Add delay to be polite
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    const response = await axios.get(url, {
        headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Referer': SOURCE_BASE_URL + '/',
            'Origin': SOURCE_BASE_URL,
        },
        timeout: 15000,
        maxRedirects: 5,
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

        // Extract anime details - multiple selector attempts
        let title = '';

        // Try various title selectors
        title = $('.infozingle span:contains("Judul") b').parent().text().replace(/Judul\s*:?\s*/i, '').trim();
        if (!title) title = $('.infozin span b').first().parent().text().replace(/Judul\s*:?\s*/i, '').trim();
        if (!title) title = $('h1.jdlrx').text().trim();
        if (!title) title = $('h1.entry-title').text().trim();
        if (!title) title = $('.venser h1').text().trim();

        if (!title) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Anime not found',
                },
            });
        }

        const thumbnail = $('.fotoanime img').attr('src') || $('.thumb img').attr('src') || '';
        const synopsis = $('.sinopc p').map((_, el) => $(el).text().trim()).get().join(' ') ||
            $('.sinopsis p').text().trim() || '';

        // Extract info fields
        const info: Record<string, string> = {};
        $('.infozingle p, .infozin p, .infozingle span, .spe span').each((_, el) => {
            const text = $(el).text();
            const colonIndex = text.indexOf(':');
            if (colonIndex > -1) {
                const key = text.substring(0, colonIndex).trim().toLowerCase();
                const value = text.substring(colonIndex + 1).trim();
                if (key && value) {
                    info[key] = value;
                }
            }
        });

        // Extract genres
        const genres: string[] = [];
        $('.infozingle a[href*="genre"], .genre-info a').each((_, el) => {
            const genre = $(el).text().trim();
            if (genre) genres.push(genre);
        });

        // Extract episodes
        const episodes: any[] = [];
        $('.episodelist ul li, .eplister ul li').each((_, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href') || '';
            const epTitle = $link.text().trim() || $el.find('.epl-title').text().trim();
            const epSlug = href.split('/').filter(Boolean).pop() || '';
            const epDate = $el.find('.epl-date, .zeind').text().trim();

            if (epSlug && epTitle) {
                episodes.push({
                    slug: epSlug,
                    title: epTitle,
                    url: href,
                    date: epDate || undefined,
                });
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
                genres,
                episodes: episodes.reverse(), // Oldest first
                totalEpisodes: episodes.length,
            },
        });
    } catch (error: any) {
        // Check if it's a 403 error
        if (error.response?.status === 403) {
            return res.status(503).json({
                success: false,
                error: {
                    code: 'SOURCE_BLOCKED',
                    message: 'Source temporarily blocked access. Try again later.',
                    hint: 'The source website has bot protection that may block requests from cloud IPs.',
                },
            });
        }

        return res.status(500).json({
            success: false,
            error: {
                code: 'SCRAPING_ERROR',
                message: error.message || 'Failed to fetch anime details',
            },
        });
    }
}
