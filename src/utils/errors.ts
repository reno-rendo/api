/**
 * Error codes for API responses
 */
export enum ErrorCode {
    INVALID_REQUEST = 'INVALID_REQUEST',
    NOT_FOUND = 'NOT_FOUND',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    SCRAPING_ERROR = 'SCRAPING_ERROR',
    SERVER_ERROR = 'SERVER_ERROR',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    TIMEOUT = 'TIMEOUT',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * HTTP status code mapping for error codes
 */
export const ErrorStatusMap: Record<ErrorCode, number> = {
    [ErrorCode.INVALID_REQUEST]: 400,
    [ErrorCode.VALIDATION_ERROR]: 400,
    [ErrorCode.NOT_FOUND]: 404,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
    [ErrorCode.SCRAPING_ERROR]: 502,
    [ErrorCode.SERVER_ERROR]: 500,
    [ErrorCode.SERVICE_UNAVAILABLE]: 503,
    [ErrorCode.TIMEOUT]: 504,
};

/**
 * Custom API Error class
 */
export class ApiError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;
    public readonly details?: unknown;
    public readonly timestamp: string;

    constructor(code: ErrorCode, message: string, details?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.statusCode = ErrorStatusMap[code];
        this.details = details;
        this.timestamp = new Date().toISOString();

        // Maintains proper stack trace for where error was thrown
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Convert error to JSON response format
     */
    toJSON(): {
        success: false;
        error: {
            code: ErrorCode;
            message: string;
            details?: unknown;
            timestamp: string;
        };
    } {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                ...(this.details && { details: this.details }),
                timestamp: this.timestamp,
            },
        };
    }

    /**
     * Create a 400 Bad Request error
     */
    static badRequest(message: string, details?: unknown): ApiError {
        return new ApiError(ErrorCode.INVALID_REQUEST, message, details);
    }

    /**
     * Create a 404 Not Found error
     */
    static notFound(resource: string): ApiError {
        return new ApiError(ErrorCode.NOT_FOUND, `${resource} not found`);
    }

    /**
     * Create a 429 Rate Limit error
     */
    static rateLimitExceeded(): ApiError {
        return new ApiError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Too many requests, please try again later');
    }

    /**
     * Create a 502 Scraping error
     */
    static scrapingError(message: string, details?: unknown): ApiError {
        return new ApiError(ErrorCode.SCRAPING_ERROR, message, details);
    }

    /**
     * Create a 503 Service Unavailable error
     */
    static serviceUnavailable(message = 'Service temporarily unavailable'): ApiError {
        return new ApiError(ErrorCode.SERVICE_UNAVAILABLE, message);
    }

    /**
     * Create a 504 Timeout error
     */
    static timeout(message = 'Request timeout'): ApiError {
        return new ApiError(ErrorCode.TIMEOUT, message);
    }

    /**
     * Create a validation error
     */
    static validation(message: string, details?: unknown): ApiError {
        return new ApiError(ErrorCode.VALIDATION_ERROR, message, details);
    }
}

/**
 * Type guard to check if error is an ApiError
 */
export const isApiError = (error: unknown): error is ApiError => {
    return error instanceof ApiError;
};
