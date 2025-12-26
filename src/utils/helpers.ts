import { env } from '../config/env.js';

/**
 * Generate a random delay in milliseconds
 */
export const randomDelay = (): Promise<void> => {
    const min = env.SCRAPER_DELAY_MIN;
    const max = env.SCRAPER_DELAY_MAX;
    const ms = Math.floor(Math.random() * (max - min) + min);
    return delay(ms);
};

/**
 * Delay for specified milliseconds
 */
export const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Slugify a string
 */
export const slugify = (text: string): string => {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

/**
 * Extract slug from URL path
 */
export const extractSlug = (url: string): string => {
    // Remove trailing slash and extract last segment
    const cleaned = url.replace(/\/$/, '');
    const parts = cleaned.split('/');
    return parts[parts.length - 1] || '';
};

/**
 * Parse number from string, returns null if invalid
 */
export const parseNumber = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

/**
 * Clean and trim text content
 */
export const cleanText = (text: string | null | undefined): string => {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
};

/**
 * Extract episode number from string
 */
export const extractEpisodeNumber = (text: string): number | null => {
    const match = text.match(/Episode\s*(\d+)/i) || text.match(/Eps?\s*(\d+)/i) || text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
};

/**
 * Format date string to ISO format
 */
export const formatDate = (dateStr: string): string | null => {
    try {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
        return null;
    }
};

/**
 * Parse Indonesian date format (e.g., "27 Desember 2024")
 */
export const parseIndonesianDate = (dateStr: string): string | null => {
    const months: Record<string, number> = {
        januari: 0,
        februari: 1,
        maret: 2,
        april: 3,
        mei: 4,
        juni: 5,
        juli: 6,
        agustus: 7,
        september: 8,
        oktober: 9,
        november: 10,
        desember: 11,
    };

    try {
        const cleaned = dateStr.toLowerCase().trim();
        const parts = cleaned.split(/\s+/);

        if (parts.length >= 3) {
            const day = parseInt(parts[0], 10);
            const month = months[parts[1]];
            const year = parseInt(parts[2], 10);

            if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                const date = new Date(year, month, day);
                return date.toISOString();
            }
        }

        return null;
    } catch {
        return null;
    }
};

/**
 * Ensure URL has base domain
 */
export const ensureAbsoluteUrl = (url: string, base: string): string => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    if (url.startsWith('//')) {
        return `https:${url}`;
    }
    if (url.startsWith('/')) {
        return `${base}${url}`;
    }
    return `${base}/${url}`;
};

/**
 * Remove HTML tags from string
 */
export const stripHtml = (html: string): string => {
    return html.replace(/<[^>]*>/g, '').trim();
};

/**
 * Capitalize first letter
 */
export const capitalize = (text: string): string => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Generate cache expiry date
 */
export const getCacheExpiryDate = (ttlSeconds: number): string => {
    return new Date(Date.now() + ttlSeconds * 1000).toISOString();
};
