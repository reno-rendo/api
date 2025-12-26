import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError, ErrorCode, isApiError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { isDevelopment } from '../config/env.js';

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Log the error
    logger.error('Error occurred', {
        error: err.message,
        stack: isDevelopment ? err.stack : undefined,
        path: req.path,
        method: req.method,
    });

    // Handle ApiError
    if (isApiError(err)) {
        res.status(err.statusCode).json(err.toJSON());
        return;
    }

    // Handle Zod validation errors
    if (err instanceof ZodError) {
        const apiError = new ApiError(ErrorCode.VALIDATION_ERROR, 'Validation failed', {
            errors: err.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
            })),
        });
        res.status(apiError.statusCode).json(apiError.toJSON());
        return;
    }

    // Handle syntax errors (bad JSON)
    if (err instanceof SyntaxError && 'body' in err) {
        const apiError = new ApiError(ErrorCode.INVALID_REQUEST, 'Invalid JSON in request body');
        res.status(apiError.statusCode).json(apiError.toJSON());
        return;
    }

    // Handle all other errors
    const apiError = new ApiError(
        ErrorCode.SERVER_ERROR,
        isDevelopment ? err.message : 'An unexpected error occurred'
    );
    res.status(apiError.statusCode).json(apiError.toJSON());
};

/**
 * 404 handler middleware
 */
export const notFoundHandler = (req: Request, res: Response): void => {
    const error = ApiError.notFound(`Route ${req.method} ${req.path}`);
    res.status(error.statusCode).json(error.toJSON());
};

/**
 * Async handler wrapper to catch Promise rejections
 */
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
