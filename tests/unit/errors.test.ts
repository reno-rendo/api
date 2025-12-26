import { describe, it, expect, beforeEach } from '@jest/globals';
import { ApiError, ErrorCode, isApiError } from '../../src/utils/errors.js';

describe('ApiError', () => {
    describe('constructor', () => {
        it('should create error with correct properties', () => {
            const error = new ApiError(ErrorCode.NOT_FOUND, 'Test not found');

            expect(error.name).toBe('ApiError');
            expect(error.code).toBe(ErrorCode.NOT_FOUND);
            expect(error.statusCode).toBe(404);
            expect(error.message).toBe('Test not found');
            expect(error.timestamp).toBeDefined();
        });

        it('should include details if provided', () => {
            const details = { field: 'slug' };
            const error = new ApiError(ErrorCode.VALIDATION_ERROR, 'Validation failed', details);

            expect(error.details).toEqual(details);
        });
    });

    describe('toJSON', () => {
        it('should return proper JSON structure', () => {
            const error = new ApiError(ErrorCode.INVALID_REQUEST, 'Bad request');
            const json = error.toJSON();

            expect(json).toEqual({
                success: false,
                error: {
                    code: ErrorCode.INVALID_REQUEST,
                    message: 'Bad request',
                    timestamp: expect.any(String),
                },
            });
        });
    });

    describe('static methods', () => {
        it('notFound should create 404 error', () => {
            const error = ApiError.notFound('Anime');
            expect(error.statusCode).toBe(404);
            expect(error.message).toBe('Anime not found');
        });

        it('badRequest should create 400 error', () => {
            const error = ApiError.badRequest('Invalid input');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe(ErrorCode.INVALID_REQUEST);
        });

        it('validation should create validation error', () => {
            const error = ApiError.validation('Field invalid', { field: 'name' });
            expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            expect(error.details).toEqual({ field: 'name' });
        });

        it('timeout should create 504 error', () => {
            const error = ApiError.timeout();
            expect(error.statusCode).toBe(504);
            expect(error.code).toBe(ErrorCode.TIMEOUT);
        });
    });
});

describe('isApiError', () => {
    it('should return true for ApiError instances', () => {
        const error = new ApiError(ErrorCode.SERVER_ERROR, 'Test');
        expect(isApiError(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
        const error = new Error('Test');
        expect(isApiError(error)).toBe(false);
    });

    it('should return false for non-errors', () => {
        expect(isApiError('error')).toBe(false);
        expect(isApiError(null)).toBe(false);
        expect(isApiError(undefined)).toBe(false);
    });
});
