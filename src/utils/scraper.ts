import axios, { AxiosInstance, AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import { env } from '../config/env';
import { logger } from './logger';
import { delay, randomDelay } from './helpers';
import { withRetry } from './retry';
import { ApiError, ErrorCode } from './errors';

/**
 * User agents for rotation to avoid detection
 */
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

/**
 * Referer URLs for rotation
 */
const REFERERS = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://duckduckgo.com/',
    'https://www.yahoo.com/',
];

/**
 * Get random item from array
 */
const getRandomItem = <T>(arr: T[]): T => {
    return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * Scraper Service - Handles all HTTP requests to source website
 */
export class ScraperService {
    private client: AxiosInstance;
    private lastRequestTime = 0;

    constructor() {
        this.client = axios.create({
            baseURL: env.SOURCE_BASE_URL,
            timeout: env.SCRAPER_TIMEOUT,
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                Connection: 'keep-alive',
                'Cache-Control': 'max-age=0',
            },
        });

        // Request interceptor for logging
        this.client.interceptors.request.use((config) => {
            logger.debug('Scraping request', {
                url: config.url,
                method: config.method,
            });
            return config;
        });

        // Response interceptor for logging
        this.client.interceptors.response.use(
            (response) => {
                logger.debug('Scraping response', {
                    url: response.config.url,
                    status: response.status,
                    size: response.data?.length || 0,
                });
                return response;
            },
            (error: AxiosError) => {
                logger.error('Scraping failed', {
                    url: error.config?.url,
                    status: error.response?.status,
                    message: error.message,
                });
                throw error;
            }
        );
    }

    /**
     * Get random User-Agent header
     */
    private getRandomUserAgent(): string {
        return getRandomItem(USER_AGENTS);
    }

    /**
     * Get random Referer header
     */
    private getRandomReferer(): string {
        return getRandomItem(REFERERS);
    }

    /**
     * Ensure minimum delay between requests
     */
    private async enforceDelay(): Promise<void> {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        const minDelay = env.SCRAPER_DELAY_MIN;

        if (elapsed < minDelay) {
            await delay(minDelay - elapsed);
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Fetch HTML content and parse with Cheerio
     */
    async fetch(path: string): Promise<CheerioAPI> {
        // Add random delay to avoid detection
        await randomDelay();
        await this.enforceDelay();

        const fetchFn = async (): Promise<CheerioAPI> => {
            try {
                const response = await this.client.get<string>(path, {
                    headers: {
                        'User-Agent': this.getRandomUserAgent(),
                        Referer: this.getRandomReferer(),
                    },
                });

                return cheerio.load(response.data);
            } catch (error) {
                if (error instanceof AxiosError) {
                    if (error.response?.status === 404) {
                        throw new ApiError(ErrorCode.NOT_FOUND, `Resource not found: ${path}`);
                    }
                    if (error.response?.status === 403) {
                        throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, 'Access denied by source website');
                    }
                    if (error.code === 'ECONNABORTED') {
                        throw new ApiError(ErrorCode.TIMEOUT, 'Request timeout');
                    }
                }
                throw new ApiError(ErrorCode.SCRAPING_ERROR, `Failed to fetch: ${path}`);
            }
        };

        return withRetry(fetchFn, env.SCRAPER_MAX_RETRIES);
    }

    /**
     * Fetch raw HTML without parsing
     */
    async fetchRaw(path: string): Promise<string> {
        await randomDelay();
        await this.enforceDelay();

        const fetchFn = async (): Promise<string> => {
            try {
                const response = await this.client.get<string>(path, {
                    headers: {
                        'User-Agent': this.getRandomUserAgent(),
                        Referer: this.getRandomReferer(),
                    },
                });

                return response.data;
            } catch (error) {
                if (error instanceof AxiosError) {
                    if (error.response?.status === 404) {
                        throw new ApiError(ErrorCode.NOT_FOUND, `Resource not found: ${path}`);
                    }
                }
                throw new ApiError(ErrorCode.SCRAPING_ERROR, `Failed to fetch: ${path}`);
            }
        };

        return withRetry(fetchFn, env.SCRAPER_MAX_RETRIES);
    }

    /**
     * Fetch with full URL (for external resources)
     */
    async fetchExternal(url: string): Promise<CheerioAPI> {
        await randomDelay();

        const fetchFn = async (): Promise<CheerioAPI> => {
            try {
                const response = await axios.get<string>(url, {
                    timeout: env.SCRAPER_TIMEOUT,
                    headers: {
                        'User-Agent': this.getRandomUserAgent(),
                        Referer: env.SOURCE_BASE_URL,
                    },
                });

                return cheerio.load(response.data);
            } catch (error) {
                throw new ApiError(ErrorCode.SCRAPING_ERROR, `Failed to fetch external: ${url}`);
            }
        };

        return withRetry(fetchFn, env.SCRAPER_MAX_RETRIES);
    }
}

/**
 * Singleton scraper instance
 */
export const scraperService = new ScraperService();
