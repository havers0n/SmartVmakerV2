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
  return createMockDrizzleDb().db;
}

type Thenable<T> = {
  then: (
    onfulfilled?: ((value: T) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null
  ) => Promise<unknown>;
};

function attachThen<T>(target: any, execute: () => Promise<T>): Thenable<T> {
  target.then = (
    onfulfilled?: ((value: T) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null
  ) => execute().then(onfulfilled as any, onrejected as any);
  return target as Thenable<T>;
}

/**
 * Creates a mock Drizzle DB with chain objects for select/insert/update/delete.
 * Prefer this in tests so you can configure/inspect calls on chain methods.
 */
export function createMockDrizzleDb() {
  const selectChain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  };
  attachThen(selectChain, () => selectChain.execute());

  const insertChain: any = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  attachThen(insertChain, () => insertChain.execute());

  const updateChain: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };

  const deleteChain: any = {
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };

  const db: any = {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
    delete: vi.fn(() => deleteChain),
    transaction: vi.fn().mockImplementation(async (callback: any) => callback(db)),
  };

  return { db, selectChain, insertChain, updateChain, deleteChain };
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
