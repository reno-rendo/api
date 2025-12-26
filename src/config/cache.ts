/**
 * Cache TTL Configuration (in seconds)
 *
 * Different TTLs based on data volatility:
 * - Static data (genres): 24 hours
 * - Semi-static (anime details): 1 hour
 * - Dynamic (home, search): 5-10 minutes
 * - Volatile (stream links): 5 minutes
 */
export const cacheTTL = {
    /** Homepage data - 5 minutes */
    home: 300,

    /** Anime detail page - 1 hour */
    anime: 3600,

    /** Episode list - 30 minutes */
    episodes: 1800,

    /** Server list - 15 minutes */
    servers: 900,

    /** Stream URLs - 5 minutes (links expire) */
    stream: 300,

    /** Search results - 10 minutes */
    search: 600,

    /** Genre list - 24 hours (rarely changes) */
    genres: 86400,

    /** Weekly schedule - 1 hour */
    schedule: 3600,

    /** Browse/filter results - 30 minutes */
    browse: 1800,

    /** Batch download links - 1 hour */
    batch: 3600,

    /** Search suggestions - 30 minutes */
    suggest: 1800,
} as const;

/**
 * Cache key prefixes for different resources
 */
export const cachePrefix = {
    home: 'otaku:home',
    anime: 'otaku:anime',
    episodes: 'otaku:episodes',
    servers: 'otaku:servers',
    stream: 'otaku:stream',
    search: 'otaku:search',
    genres: 'otaku:genres',
    schedule: 'otaku:schedule',
    browse: 'otaku:browse',
    batch: 'otaku:batch',
    suggest: 'otaku:suggest',
} as const;

/**
 * Generate cache key for a resource
 */
export const generateCacheKey = (prefix: keyof typeof cachePrefix, ...params: string[]): string => {
    const base = cachePrefix[prefix];
    if (params.length === 0) {
        return base;
    }
    return `${base}:${params.join(':')}`;
};

/**
 * Get TTL for a cache prefix
 */
export const getTTL = (prefix: keyof typeof cacheTTL): number => {
    return cacheTTL[prefix];
};
