/**
 * Vitest setup file
 * Runs before all tests
 */

import { vi } from 'vitest';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';

// Global test utilities can be added here
