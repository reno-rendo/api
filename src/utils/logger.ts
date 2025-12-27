import winston from 'winston';
import path from 'path';
import { env, isDevelopment, isTest } from '../config/env';

/**
 * Custom log format
 */
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

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
 * Create Winston logger instance
 */
const createLogger = (): winston.Logger => {
    const transports: winston.transport[] = [];

    // File transports (not in test mode)
    if (!isTest) {
        // Error logs
        transports.push(
            new winston.transports.File({
                filename: path.join(env.LOG_FILE_PATH, 'error.log'),
                level: 'error',
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
                format: logFormat,
            })
        );

        // Combined logs
        transports.push(
            new winston.transports.File({
                filename: path.join(env.LOG_FILE_PATH, 'combined.log'),
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 10,
                format: logFormat,
            })
        );
    }

    // Console transport for development
    if (isDevelopment) {
        transports.push(
            new winston.transports.Console({
                format: consoleFormat,
            })
        );
    }

    return winston.createLogger({
        level: isTest ? 'silent' : env.LOG_LEVEL,
        format: logFormat,
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
