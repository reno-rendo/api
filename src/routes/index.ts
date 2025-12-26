import { Router } from 'express';
import {
    basicHealth,
    detailedHealth,
    getHome,
    getGenres,
    searchAnime,
    searchSuggest,
    getAnimeDetail,
    getEpisodes,
    getServers,
    getStream,
    getSchedule,
    getBatch,
    proxyRequest,
} from '../controllers/index.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { validateQuery, validateParams } from '../middleware/validation.middleware.js';
import {
    globalRateLimiter,
    searchRateLimiter,
    streamRateLimiter,
    proxyRateLimiter,
} from '../config/rate-limit.js';
import {
    slugParamsSchema,
    searchQuerySchema,
    episodeQuerySchema,
    streamQuerySchema,
    suggestQuerySchema,
    scheduleQuerySchema,
    proxyQuerySchema,
} from '../schemas/request.schemas.js';

const router = Router();

/**
 * Health check routes (no rate limiting)
 */
router.get('/health', basicHealth);
router.get('/health/detailed', asyncHandler(detailedHealth));

/**
 * API routes
 * All routes under /api are rate limited
 */
const apiRouter = Router();
apiRouter.use(globalRateLimiter);

// ============================================
// HOME
// ============================================

/**
 * GET /api/home
 * Homepage data with ongoing anime and latest episodes
 */
apiRouter.get('/home', asyncHandler(getHome));

// ============================================
// GENRES
// ============================================

/**
 * GET /api/genres
 * List of all available genres
 */
apiRouter.get('/genres', asyncHandler(getGenres));

// ============================================
// SEARCH
// ============================================

/**
 * GET /api/search?q={query}&limit={limit}
 * Search for anime by keyword
 */
apiRouter.get(
    '/search',
    searchRateLimiter,
    validateQuery(searchQuerySchema),
    asyncHandler(searchAnime)
);

/**
 * GET /api/search/suggest?q={query}
 * Search suggestions/autocomplete
 */
apiRouter.get(
    '/search/suggest',
    searchRateLimiter,
    validateQuery(suggestQuerySchema),
    asyncHandler(searchSuggest)
);

// ============================================
// ANIME
// ============================================

/**
 * GET /api/anime/:slug
 * Detailed anime information
 */
apiRouter.get(
    '/anime/:slug',
    validateParams(slugParamsSchema),
    asyncHandler(getAnimeDetail)
);

// ============================================
// EPISODES
// ============================================

/**
 * GET /api/episodes/:slug
 * Episode list for an anime
 */
apiRouter.get(
    '/episodes/:slug',
    validateParams(slugParamsSchema),
    asyncHandler(getEpisodes)
);

// ============================================
// SERVERS
// ============================================

/**
 * GET /api/servers?epId={episodeSlug}
 * Available streaming servers for an episode
 */
apiRouter.get(
    '/servers',
    validateQuery(episodeQuerySchema),
    asyncHandler(getServers)
);

// ============================================
// STREAM
// ============================================

/**
 * GET /api/stream?epId={episodeSlug}&server={serverId}
 * Streaming URL for a specific server
 */
apiRouter.get(
    '/stream',
    streamRateLimiter,
    validateQuery(streamQuerySchema),
    asyncHandler(getStream)
);

// ============================================
// SCHEDULE
// ============================================

/**
 * GET /api/schedule?day={day}
 * Weekly anime release schedule
 */
apiRouter.get(
    '/schedule',
    validateQuery(scheduleQuerySchema),
    asyncHandler(getSchedule)
);

// ============================================
// BATCH
// ============================================

/**
 * GET /api/batch/:slug
 * Batch download links for an anime
 */
apiRouter.get(
    '/batch/:slug',
    validateParams(slugParamsSchema),
    asyncHandler(getBatch)
);

// ============================================
// PROXY
// ============================================

/**
 * GET /api/proxy?url={encodedUrl}
 * Proxy requests to allowed domains
 */
apiRouter.get(
    '/proxy',
    proxyRateLimiter,
    validateQuery(proxyQuerySchema),
    asyncHandler(proxyRequest)
);

router.use('/api', apiRouter);

export default router;
