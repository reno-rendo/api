import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { ApiError, ErrorCode } from '../utils/errors.js';

/**
 * Validation source types
 */
type ValidationSource = 'body' | 'query' | 'params';

/**
 * Create validation middleware for a Zod schema
 */
export const validate = (
    schema: ZodSchema,
    source: ValidationSource = 'body'
): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const data = req[source];
            const result = schema.safeParse(data);

            if (!result.success) {
                const error = new ApiError(ErrorCode.VALIDATION_ERROR, 'Validation failed', {
                    errors: result.error.errors.map((e) => ({
                        path: e.path.join('.'),
                        message: e.message,
                    })),
                });
                res.status(error.statusCode).json(error.toJSON());
                return;
            }

            // Replace with validated/transformed data
            req[source] = result.data;
            next();
        } catch (err) {
            next(err);
        }
    };
};

/**
 * Validate query parameters
 */
export const validateQuery = (schema: ZodSchema): RequestHandler => validate(schema, 'query');

/**
 * Validate URL parameters
 */
export const validateParams = (schema: ZodSchema): RequestHandler => validate(schema, 'params');

/**
 * Validate request body
 */
export const validateBody = (schema: ZodSchema): RequestHandler => validate(schema, 'body');
