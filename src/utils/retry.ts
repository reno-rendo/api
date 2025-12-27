import { logger } from './logger';
import { ApiError, ErrorCode } from './errors';

/**
 * Default retry configuration
 */
interface RetryConfig {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
};

/**
 * Delay helper function
 */
export const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Calculate delay with exponential backoff
 */
const calculateDelay = (attempt: number, config: RetryConfig): number => {
    const delay = config.initialDelay * Math.pow(config.backoffFactor, attempt - 1);
    return Math.min(delay, config.maxDelay);
};

/**
 * Check if error is retryable
 */
const isRetryableError = (error: unknown): boolean => {
    if (error instanceof ApiError) {
        // Don't retry client errors (4xx) except for rate limiting
        const nonRetryable = [ErrorCode.INVALID_REQUEST, ErrorCode.NOT_FOUND, ErrorCode.VALIDATION_ERROR];
        return !nonRetryable.includes(error.code);
    }

    // Retry network errors
    if (error instanceof Error) {
        const retryableMessages = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'timeout'];
        return retryableMessages.some((msg) => error.message.includes(msg));
    }

    return true;
};

/**
 * Execute function with retry logic
 *
 * @param fn Function to execute
 * @param maxRetries Maximum number of retries (default: 3)
 * @param config Optional retry configuration
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = DEFAULT_RETRY_CONFIG.maxRetries,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config, maxRetries };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            // Check if we should retry
            if (attempt > retryConfig.maxRetries) {
                break;
            }

            if (!isRetryableError(error)) {
                logger.debug('Non-retryable error, not retrying', {
                    error: lastError.message,
                    attempt,
                });
                break;
            }

            // Calculate delay with exponential backoff
            const delayMs = calculateDelay(attempt, retryConfig);

            logger.warn('Retrying after error', {
                error: lastError.message,
                attempt,
                maxRetries: retryConfig.maxRetries,
                delayMs,
            });

            await delay(delayMs);
        }
    }

    throw lastError;
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            reject(new ApiError(ErrorCode.TIMEOUT, `Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    return Promise.race([fn(), timeoutPromise]);
}

/**
 * Execute with retry and timeout
 */
export async function withRetryAndTimeout<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    timeoutMs: number
): Promise<T> {
    return withRetry(() => withTimeout(fn, timeoutMs), maxRetries);
}
