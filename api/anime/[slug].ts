// Vercel Serverless Function - Anime Detail Endpoint
// Using alternative approaches to bypass bot protection
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import * as cheerio from 'cheerio';

const SOURCE_BASE_URL = 'https://otakudesu.best';

// User agent rotation - more comprehensive list
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];

// Free CORS proxies to try
const PROXY_URLS = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Try fetching with different methods
async function fetchWithRetry(url: string): Promise<cheerio.CheerioAPI | null> {
    // Method 1: Direct request with enhanced headers
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'max-age=0',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'Referer': SOURCE_BASE_URL + '/anime/',
                'Cookie': 'viewed=1',
            },
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500,
        });

        if (response.status === 200) {
            return cheerio.load(response.data);
        }
    } catch (e) {
        // Continue to try proxies
    }

    // Method 2: Try through CORS proxies
    for (const proxyBase of PROXY_URLS) {
        try {
            const proxyUrl = proxyBase + encodeURIComponent(url);
            const response = await axios.get(proxyUrl, {
                headers: {
                    'User-Agent': getRandomUserAgent(),
                },
                timeout: 15000,
            });

            if (response.status === 200 && response.data) {
                return cheerio.load(response.data);
            }
        } catch (e) {
            // Try next proxy
            continue;
        }
    }

    return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

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

        const targetUrl = `${SOURCE_BASE_URL}/anime/${slug}/`;
        const $ = await fetchWithRetry(targetUrl);

        if (!$) {
            return res.status(503).json({
                success: false,
                error: {
                    code: 'SOURCE_UNAVAILABLE',
                    message: 'Unable to fetch from source. All methods failed.',
                    suggestion: 'Try again later or use a different anime slug.',
                },
            });
        }

        // Extract anime details - multiple selector attempts
        let title = '';

        // Try various title selectors
        title = $('.infozingle span:contains("Judul")').parent().text().replace(/Judul\s*:?\s*/i, '').trim();
        if (!title) title = $('.infozin span b').first().parent().text().replace(/Judul\s*:?\s*/i, '').trim();
        if (!title) title = $('h1.jdlrx').text().trim();
        if (!title) title = $('h1.entry-title').text().trim();
        if (!title) title = $('.venser h1').text().trim();
        if (!title) title = $('title').text().split('|')[0]?.trim() || '';

        if (!title) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Anime not found or page structure changed',
                },
            });
        }

        const thumbnail = $('.fotoanime img').attr('src') ||
            $('.thumb img').attr('src') ||
            $('img.wp-post-image').attr('src') || '';

        const synopsis = $('.sinopc p').map((_, el) => $(el).text().trim()).get().join(' ') ||
            $('.sinopsis p').text().trim() ||
            $('p:contains("Sinopsis")').next('p').text().trim() || '';

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
        $('.infozingle a[href*="genre"], .genre-info a, a[href*="/genre/"]').each((_, el) => {
            const genre = $(el).text().trim();
            if (genre && !genres.includes(genre)) genres.push(genre);
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
        return res.status(500).json({
            success: false,
            error: {
                code: 'SCRAPING_ERROR',
                message: error.message || 'Failed to fetch anime details',
            },
        });
    }
}
