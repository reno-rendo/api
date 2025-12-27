import winston from 'winston';

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
    })
);

/**
 * JSON format for production/serverless
 */
const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

/**
 * Check environment
 */
const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Create Winston logger instance
 * Uses console-only (no file system for serverless compatibility)
 */
const createLogger = (): winston.Logger => {
    const transports: winston.transport[] = [];

    // Always use console - works in all environments including serverless
    transports.push(
        new winston.transports.Console({
            format: isDev ? consoleFormat : jsonFormat,
        })
    );

    return winston.createLogger({
        level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
        format: jsonFormat,
        defaultMeta: { service: 'otakudesu-api' },
        transports,
    });
};

/**
 * Logger instance
 */
export const logger = createLogger();

/**
 * Request logger utility
 */
export const logRequest = (
    method: string,
    url: string,
    status: number,
    duration: number,
    cached: boolean
): void => {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    logger.log(level, 'Request completed', {
        method,
        url,
        status,
        duration: `${duration}ms`,
        cached,
    });
};

/**
 * Scraping logger utility
 */
export const logScraping = (
    action: 'start' | 'success' | 'error',
    url: string,
    details?: unknown
): void => {
    const level = action === 'error' ? 'error' : 'debug';
    const logData: Record<string, unknown> = { url };
    if (details) {
        logData.details = details;
    }
    logger.log(level, `Scraping ${action}`, logData);
};

/**
 * Cache logger utility
 */
export const logCache = (action: 'hit' | 'miss' | 'set' | 'delete', key: string): void => {
    logger.debug(`Cache ${action}`, { key });
};
