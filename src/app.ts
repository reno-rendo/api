import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { env, isDevelopment } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import routes from './routes/index.js';

/**
 * Create and configure Express application
 */
const createApp = (): Express => {
    const app = express();

    // Trust proxy (for rate limiting behind reverse proxy)
    app.set('trust proxy', 1);

    // Security middleware
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                },
            },
            crossOriginEmbedderPolicy: false,
            crossOriginResourcePolicy: { policy: 'cross-origin' },
        })
    );

    // CORS configuration
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    app.use(
        cors({
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or curl)
                if (!origin) {
                    callback(null, true);
                    return;
                }
                if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ['GET', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
            maxAge: 86400,
        })
    );

    // Compression
    app.use(compression());

    // Body parsing
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Request logging middleware
    app.use((req: Request, res: Response, next: NextFunction) => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            const cached = res.getHeader('X-Cache') === 'HIT';

            // Log non-health check requests
            if (!req.path.startsWith('/health')) {
                const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
                logger.log(level, 'Request', {
                    method: req.method,
                    path: req.path,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    cached,
                    ip: req.ip,
                });
            }
        });

        next();
    });

    // API version prefix
    app.use(`/${env.API_VERSION}`, routes);

    // Also mount routes at root for convenience
    app.use('/', routes);

    // 404 handler
    app.use(notFoundHandler);

    // Global error handler
    app.use(errorHandler);

    return app;
};

/**
 * Start the server
 */
const startServer = async (): Promise<void> => {
    const app = createApp();
    const port = env.PORT;

    app.listen(port, () => {
        logger.info('🚀 Server started', {
            port,
            env: env.NODE_ENV,
            version: env.API_VERSION,
        });

        if (isDevelopment) {
            logger.info(`📚 API available at http://localhost:${port}/api`);
            logger.info(`❤️ Health check at http://localhost:${port}/health`);
        }
    });
};

// Start server
startServer().catch((error) => {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
});

export default createApp;
