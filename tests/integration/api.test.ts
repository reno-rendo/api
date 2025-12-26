import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Note: This is a basic test setup. For full testing, mock the scraper service.

describe('Health Endpoints', () => {
    let app: express.Express;

    beforeAll(async () => {
        // Import app after setting test environment
        process.env.NODE_ENV = 'test';
        const { default: createApp } = await import('../src/app.js');
        app = createApp();
    });

    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'ok');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
        });
    });

    describe('GET /health/detailed', () => {
        it('should return detailed health status', async () => {
            const response = await request(app)
                .get('/health/detailed')
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('checks');
        });
    });
});

describe('API Endpoints', () => {
    let app: express.Express;

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        const { default: createApp } = await import('../src/app.js');
        app = createApp();
    });

    describe('GET /api/home', () => {
        it('should return home data', async () => {
            const response = await request(app)
                .get('/api/home')
                .expect('Content-Type', /json/);

            // May fail if source is unavailable in test
            if (response.status === 200) {
                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('ongoing');
                expect(response.body.data).toHaveProperty('latestEpisodes');
            }
        }, 30000);
    });

    describe('GET /api/search', () => {
        it('should require q parameter', async () => {
            const response = await request(app)
                .get('/api/search')
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
        });

        it('should search with valid query', async () => {
            const response = await request(app)
                .get('/api/search?q=spy')
                .expect('Content-Type', /json/);

            if (response.status === 200) {
                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toHaveProperty('query', 'spy');
                expect(response.body.data).toHaveProperty('results');
            }
        }, 30000);
    });

    describe('GET /api/genres', () => {
        it('should return genres list', async () => {
            const response = await request(app)
                .get('/api/genres')
                .expect('Content-Type', /json/);

            if (response.status === 200) {
                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toHaveProperty('genres');
                expect(Array.isArray(response.body.data.genres)).toBe(true);
            }
        }, 30000);
    });

    describe('GET /api/anime/:slug', () => {
        it('should return 404 for invalid slug', async () => {
            const response = await request(app)
                .get('/api/anime/invalid-anime-slug-12345')
                .expect('Content-Type', /json/);

            // Should be 404 or scraping error
            expect([404, 502]).toContain(response.status);
        }, 30000);
    });
});
