import { z } from 'zod';

/**
 * Slug validation schema
 */
export const slugSchema = z.string().min(1).max(200).regex(/^[a-z0-9-]+$/i, 'Invalid slug format');

/**
 * Slug params schema
 */
export const slugParamsSchema = z.object({
    slug: slugSchema,
});

/**
 * Search query schema
 */
export const searchQuerySchema = z.object({
    q: z.string().min(1, 'Search query is required').max(100),
    limit: z.coerce.number().min(1).max(50).default(20),
});

/**
 * Episode ID query schema
 */
export const episodeQuerySchema = z.object({
    epId: z.string().min(1, 'Episode ID is required'),
});

/**
 * Stream query schema
 */
export const streamQuerySchema = z.object({
    epId: z.string().min(1, 'Episode ID is required'),
    server: z.string().min(1, 'Server is required'),
});

/**
 * Schedule query schema
 */
export const scheduleQuerySchema = z.object({
    day: z
        .enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
        .optional(),
});

/**
 * Browse/filter query schema
 */
export const browseQuerySchema = z.object({
    genre: z.string().optional(),
    year: z.coerce.number().min(1990).max(2030).optional(),
    type: z.enum(['tv', 'movie', 'ova', 'ona', 'special']).optional(),
    status: z.enum(['ongoing', 'completed', 'upcoming']).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
    sort: z.enum(['rating', 'title', 'latest']).default('latest'),
});

/**
 * Proxy query schema
 */
export const proxyQuerySchema = z.object({
    url: z
        .string()
        .url('Invalid URL format')
        .refine(
            (url) => {
                const allowedDomains = ['otakudesu.best', 'stream.otakudesu.best', 'cdn.otakudesu.best'];
                return allowedDomains.some((domain) => url.includes(domain));
            },
            { message: 'Domain not allowed' }
        ),
});

/**
 * Search suggest query schema
 */
export const suggestQuerySchema = z.object({
    q: z.string().min(2, 'Query must be at least 2 characters').max(50),
});

/**
 * Pagination query schema
 */
export const paginationQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
});
