import PQueue from 'p-queue';
import { logger } from '../utils/logger.js';

/**
 * Queue configuration
 */
interface QueueConfig {
    /** Maximum concurrent requests */
    concurrency: number;
    /** Interval in milliseconds for rate limiting */
    interval: number;
    /** Maximum requests per interval */
    intervalCap: number;
    /** Timeout for each task in milliseconds */
    timeout: number;
}

const DEFAULT_CONFIG: QueueConfig = {
    concurrency: 2,
    interval: 1000,
    intervalCap: 3,
    timeout: 30000,
};

/**
 * Request Queue Service - Manages concurrent scraping requests
 *
 * Prevents overwhelming the source website by:
 * - Limiting concurrent requests
 * - Enforcing rate limits
 * - Providing timeout handling
 */
export class QueueService {
    private queue: PQueue;
    private config: QueueConfig;

    constructor(config: Partial<QueueConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        this.queue = new PQueue({
            concurrency: this.config.concurrency,
            interval: this.config.interval,
            intervalCap: this.config.intervalCap,
            timeout: this.config.timeout,
            throwOnTimeout: true,
        });

        // Log queue events
        this.queue.on('active', () => {
            logger.debug('Queue task started', {
                pending: this.queue.pending,
                size: this.queue.size,
            });
        });

        this.queue.on('idle', () => {
            logger.debug('Queue is idle');
        });

        this.queue.on('error', (error) => {
            logger.error('Queue error', { error: error.message });
        });
    }

    /**
     * Add a task to the queue
     */
    async add<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
        return this.queue.add(fn, { priority }) as Promise<T>;
    }

    /**
     * Add multiple tasks to the queue
     */
    async addAll<T>(fns: Array<() => Promise<T>>, priority = 0): Promise<T[]> {
        return Promise.all(fns.map((fn) => this.add(fn, priority)));
    }

    /**
     * Get current queue size
     */
    get size(): number {
        return this.queue.size;
    }

    /**
     * Get number of pending tasks
     */
    get pending(): number {
        return this.queue.pending;
    }

    /**
     * Check if queue is paused
     */
    get isPaused(): boolean {
        return this.queue.isPaused;
    }

    /**
     * Pause the queue
     */
    pause(): void {
        this.queue.pause();
        logger.info('Queue paused');
    }

    /**
     * Resume the queue
     */
    start(): void {
        this.queue.start();
        logger.info('Queue resumed');
    }

    /**
     * Clear all pending tasks
     */
    clear(): void {
        this.queue.clear();
        logger.info('Queue cleared');
    }

    /**
     * Wait for all tasks to complete
     */
    async onIdle(): Promise<void> {
        return this.queue.onIdle();
    }

    /**
     * Get queue statistics
     */
    getStats(): { size: number; pending: number; isPaused: boolean } {
        return {
            size: this.size,
            pending: this.pending,
            isPaused: this.isPaused,
        };
    }
}

/**
 * Default queue instance for scraping requests
 */
export const scraperQueue = new QueueService({
    concurrency: 2,
    interval: 1000,
    intervalCap: 3,
    timeout: 30000,
});

/**
 * High priority queue for critical requests
 */
export const priorityQueue = new QueueService({
    concurrency: 1,
    interval: 500,
    intervalCap: 2,
    timeout: 15000,
});
