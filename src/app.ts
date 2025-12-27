import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { env, isDevelopment, isProduction } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { logger } from './utils/logger.js';

/**
 * Create Express application
 */
const createApp = (): Express => {
    const app = express();

    // Trust proxy for rate limiting behind reverse proxy
    app.set('trust proxy', 1);

    // Security middleware
    app.use(
        helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false,
        })
    );

    // CORS
    const corsOptions = {
        origin: env.ALLOWED_ORIGINS === '*' ? '*' : env.ALLOWED_ORIGINS.split(','),
        methods: ['GET', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
        maxAge: 86400,
    };
    app.use(cors(corsOptions));

    // Compression
    app.use(compression());

    // Parse JSON (limit payload size)
    app.use(express.json({ limit: '1mb' }));

    // Request logging (skip in production for performance)
    if (isDevelopment) {
        app.use((req: Request, _res: Response, next: NextFunction) => {
            logger.debug(`${req.method} ${req.path}`);
            next();
        });
    }

    // API routes
    app.use('/', routes);

    // 404 handler
    app.use(notFoundHandler);

    // Error handler
    app.use(errorHandler);

    return app;
};

const app = createApp();

// For local development
if (!isProduction) {
    const PORT = env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📋 Environment: ${env.NODE_ENV}`);
    });
}

// Export for Vercel serverless
export default app;
