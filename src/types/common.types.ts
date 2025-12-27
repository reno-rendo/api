/**
 * Common type definitions
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    cache?: {
        cached: boolean;
        expiresAt?: string | null;
        source?: 'redis' | 'memory';
    };
}

/**
 * Error response
 */
export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
        timestamp: string;
    };
}

/**
 * Pagination info
 */
export interface Pagination {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends ApiResponse<T> {
    pagination: Pagination;
}

/**
 * Genre item
 */
export interface Genre {
    slug: string;
    name: string;
    count?: number;
}

/**
 * Schedule item
 */
export interface ScheduleItem {
    day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    anime: Array<{
        slug: string;
        title: string;
        thumbnail: string;
        releaseTime?: string;
        nextEpisode?: number;
    }>;
}

/**
 * Server/Mirror info
 */
export interface ServerInfo {
    name: string;
    quality?: string;
    type: 'streaming' | 'download';
    serverId: string;
}

/**
 * Stream info
 */
export interface StreamInfo {
    episodeSlug: string;
    serverName: string;
    streamUrl: string;
    quality?: string;
    subtitles?: Array<{
        language: string;
        url: string;
        format: 'vtt' | 'srt';
    }>;
    headers?: {
        referer?: string;
        userAgent?: string;
    };
    expiresAt?: string;
}

/**
 * Batch download info
 */
export interface BatchInfo {
    animeSlug: string;
    animeTitle: string;
    batchLinks: Array<{
        quality: string;
        size?: string;
        links: Array<{
            host: string;
            url: string;
        }>;
    }>;
}

/**
 * Health check response
 */
export interface HealthCheck {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    uptime?: number;
    checks?: {
        api: { status: string };
        cache: { status: string; message?: string };
        source: { status: string; responseTime?: number; message?: string };
    };
}
