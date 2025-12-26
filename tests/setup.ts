// Jest setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.example' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
beforeAll(() => {
    // Setup before all tests
});

afterAll(() => {
    // Cleanup after all tests
});
