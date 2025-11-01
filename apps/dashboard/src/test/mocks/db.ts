/**
 * Database mocking utilities for tests
 * Provides mock implementations of database operations
 */

import { vi } from 'vitest';

/**
 * Creates a mock Drizzle database instance
 * Useful for mocking database queries in action handlers
 */
export function createMockDb() {
  return {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn().mockImplementation(async (callback) => {
      // Mock transaction - just call the callback with the mock db
      return callback(createMockDb());
    }),
  };
}

/**
 * Mock job record for ingest queue
 */
export function createMockIngestJob(overrides = {}) {
  return {
    id: 1,
    query: 'test query',
    status: 'pending',
    max_results: 25,
    order_by: 'date',
    safe_search: 'moderate',
    search_type: 'video',
    retry_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Mock analysis job record
 */
export function createMockAnalysisJob(overrides = {}) {
  return {
    id: 1,
    video_id: 123,
    analyzer: 'default',
    status: 'pending',
    retry_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Mock video record
 */
export function createMockVideo(overrides = {}) {
  return {
    id: 123,
    youtube_id: 'test-video-id',
    url: 'https://youtube.com/watch?v=test-video-id',
    title: 'Test Video',
    description: 'Test description',
    published_at: new Date().toISOString(),
    channel_title: 'Test Channel',
    view_count: 1000,
    like_count: 50,
    comment_count: 10,
    duration_seconds: 60,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Setup mock for @/shared/lib/db module
 * Call this in your test file's beforeEach or describe block
 */
export function mockDbModule() {
  const mockDb = createMockDb();

  vi.mock('@/shared/lib/db', () => ({
    db: mockDb,
  }));

  return mockDb;
}

/**
 * Setup mock for getDrizzleClient from @scrimspec/db
 * Call this in your test file's beforeEach or describe block
 */
export function mockGetDrizzleClient() {
  const mockDb = createMockDb();

  vi.mock('@scrimspec/db', () => ({
    getDrizzleClient: vi.fn(() => mockDb),
    schema: {
      ingestJobQueue: {},
      analysisJobQueue: {},
      analysisResults: {},
      youtubeVideos: {},
    },
    sql: vi.fn(),
  }));

  return mockDb;
}
