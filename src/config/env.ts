import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Environment variables validation schema
 */
const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    API_VERSION: z.string().default('v1'),

    // Source website
    SOURCE_BASE_URL: z.string().url().default('https://otakudesu.best'),

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().default(0),

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
    RATE_LIMIT_MAX: z.coerce.number().default(1000),

    // CORS
    ALLOWED_ORIGINS: z.string().default('*'),

    // Logging
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    LOG_FILE_PATH: z.string().default('./logs'),

    // API Keys (optional)
    REQUIRE_API_KEY: z
        .string()
        .transform((val) => val === 'true')
        .default('false'),
    API_KEYS: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(',').map((k) => k.trim()) : [])),

    // Scraper
    SCRAPER_TIMEOUT: z.coerce.number().default(10000),
    SCRAPER_MAX_RETRIES: z.coerce.number().default(3),
    SCRAPER_DELAY_MIN: z.coerce.number().default(500),
    SCRAPER_DELAY_MAX: z.coerce.number().default(2000),
});

/**
 * Parsed and validated environment variables
 */
const parseEnv = (): z.infer<typeof envSchema> => {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error('❌ Invalid environment variables:');
        console.error(result.error.format());
        throw new Error('Invalid environment variables');
    }

    return result.data;
};

export const env = parseEnv();

/**
 * Environment helpers
 */
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
