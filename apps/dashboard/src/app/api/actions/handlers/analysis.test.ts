/**
 * Tests for analysis action handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startAnalysis } from './analysis';
import { ZodError } from 'zod';

// Mock @scrimspec/core-domain
vi.mock('@scrimspec/core-domain', () => ({
  startAnalysisPayloadSchema: {
    parse: vi.fn((payload) => {
      // Simple validation mock
      if (!payload.videoIds || !Array.isArray(payload.videoIds)) {
        throw new Error('Invalid payload');
      }
      // Mirror expected domain behavior: default analyzer when not provided
      return { ...payload, analyzer: payload.analyzer ?? 'default' };
    }),
  },
}));

// Mock @scrimspec/db
var mockDb: any;
var selectChain: any;
var insertChain: any;

vi.mock('@scrimspec/db', () => {
  // SELECT chain must be thenable because handler awaits the builder.
  selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    then: (onfulfilled?: any, onrejected?: any) => selectChain.execute().then(onfulfilled, onrejected),
  };

  // INSERT chain is awaited too: `await db.insert(...).values(...)`.
  insertChain = {
    values: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    then: (onfulfilled?: any, onrejected?: any) => insertChain.execute().then(onfulfilled, onrejected),
  };

  mockDb = {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
  };

  return {
    getDrizzleClient: vi.fn(() => mockDb),
    schema: {
      analysisResults: { videoId: 'videoId' },
      analysisJobQueue: {},
    },
  };
});

// Mock logger
vi.mock('@aec/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  inArray: vi.fn((field, values) => ({ field, values })),
}));

describe('startAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should accept valid payload with video IDs', async () => {
      const payload = {
        videoIds: [1, 2, 3],
      };

      const result = await startAnalysis(payload);

      expect(result.success).toBe(true);
      expect(result.data?.newJobsCreated).toBe(3);
    });

    it('should reject invalid payload', async () => {
      const { startAnalysisPayloadSchema } = await import('@scrimspec/core-domain');

      (startAnalysisPayloadSchema.parse as any).mockImplementationOnce(() => {
        throw new ZodError([
          {
            code: 'invalid_type',
            expected: 'array',
            received: 'undefined',
            path: ['videoIds'],
            message: 'Required',
          },
        ]);
      });

      const payload = {};

      const result = await startAnalysis(payload);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid payload');
    });
  });

  describe('Duplicate Detection', () => {
    it('should skip videos that already have analysis', async () => {
      const { getDrizzleClient } = await import('@scrimspec/db');
      const mockDb = getDrizzleClient();

      // Mock existing analysis for video 1 and 2
      selectChain.execute.mockResolvedValueOnce([
        { videoId: 1 },
        { videoId: 2 },
      ]);

      const payload = {
        videoIds: [1, 2, 3], // 1 and 2 already analyzed, only 3 is new
      };

      const result = await startAnalysis(payload);

      expect(result.success).toBe(true);
      expect(result.data?.totalRequested).toBe(3);
      expect(result.data?.alreadyAnalyzed).toBe(2);
      expect(result.data?.newJobsCreated).toBe(1);
    });

    it('should return early if all videos already analyzed', async () => {
      const { getDrizzleClient } = await import('@scrimspec/db');
      const mockDb = getDrizzleClient();

      // Mock that all videos already have analysis
      selectChain.execute.mockResolvedValueOnce([
        { videoId: 1 },
        { videoId: 2 },
        { videoId: 3 },
      ]);

      const payload = {
        videoIds: [1, 2, 3],
      };

      const result = await startAnalysis(payload);

      expect(result.success).toBe(true);
      expect(result.message).toContain('already been analyzed');
      expect(result.data?.newJobsCreated).toBe(0);

      // Should not insert any jobs
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('Job Creation', () => {
    it('should create analysis jobs for videos without existing analysis', async () => {
      const { getDrizzleClient } = await import('@scrimspec/db');
      const mockDb = getDrizzleClient();

      // Mock no existing analysis
      selectChain.execute.mockResolvedValueOnce([]);

      const payload = {
        videoIds: [1, 2, 3],
      };

      const result = await startAnalysis(payload);

      expect(result.success).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            videoId: 1,
            analyzer: 'default',
            status: 'pending',
            retryCount: 0,
          }),
          expect.objectContaining({
            videoId: 2,
            analyzer: 'default',
            status: 'pending',
            retryCount: 0,
          }),
          expect.objectContaining({
            videoId: 3,
            analyzer: 'default',
            status: 'pending',
            retryCount: 0,
          }),
        ])
      );
    });

    it('should only create jobs for new videos', async () => {
      const { getDrizzleClient } = await import('@scrimspec/db');
      const mockDb = getDrizzleClient();

      // Mock existing analysis for video 1
      selectChain.execute.mockResolvedValueOnce([{ videoId: 1 }]);

      const payload = {
        videoIds: [1, 2, 3],
      };

      await startAnalysis(payload);

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ videoId: 2 }),
          expect.objectContaining({ videoId: 3 }),
        ])
      );

      // Should not create job for video 1
      expect(insertChain.values).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ videoId: 1 }),
        ])
      );
    });
  });

  describe('Response Format', () => {
    it('should return success response with job counts', async () => {
      const { getDrizzleClient } = await import('@scrimspec/db');
      const mockDb = getDrizzleClient();

      selectChain.execute.mockResolvedValueOnce([]);

      const payload = {
        videoIds: [1, 2],
      };

      const result = await startAnalysis(payload);

      expect(result).toEqual({
        success: true,
        message: expect.stringContaining('2 analysis jobs'),
        data: {
          totalRequested: 2,
          alreadyAnalyzed: 0,
          newJobsCreated: 2,
        },
      });
    });

    it('should include singular/plural in message', async () => {
      const { getDrizzleClient } = await import('@scrimspec/db');
      const mockDb = getDrizzleClient();

      selectChain.execute.mockResolvedValueOnce([]);

      const payload = {
        videoIds: [1], // Single video
      };

      const result = await startAnalysis(payload);

      expect(result.message).toContain('1 analysis job'); // Singular
      expect(result.message).not.toContain('jobs'); // Not plural
    });

    it('should mention already analyzed videos in message', async () => {
      const { getDrizzleClient } = await import('@scrimspec/db');
      const mockDb = getDrizzleClient();

      selectChain.execute.mockResolvedValueOnce([
        { videoId: 1 },
        { videoId: 2 },
      ]);

      const payload = {
        videoIds: [1, 2, 3],
      };

      const result = await startAnalysis(payload);

      expect(result.message).toContain('2 videos were already analyzed');
    });
  });

  describe('Error Handling', () => {
    it('should catch and return Zod validation errors', async () => {
      const { startAnalysisPayloadSchema } = await import('@scrimspec/core-domain');

      (startAnalysisPayloadSchema.parse as any).mockImplementationOnce(() => {
        throw new ZodError([
          {
            code: 'too_small',
            minimum: 1,
            type: 'array',
            inclusive: true,
            exact: false,
            path: ['videoIds'],
            message: 'Array must contain at least 1 element(s)',
          },
        ]);
      });

      const payload = {
        videoIds: [],
      };

      const result = await startAnalysis(payload);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid payload');
      expect(result.errors).toBeDefined();
    });

    it('should catch and return database errors', async () => {
      const { getDrizzleClient } = await import('@scrimspec/db');
      const mockDb = getDrizzleClient();

      selectChain.execute.mockRejectedValueOnce(new Error('Database connection failed'));

      const payload = {
        videoIds: [1, 2, 3],
      };

      const result = await startAnalysis(payload);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to start analysis');
      expect(result.error).toContain('Database connection failed');
    });

    it('should handle unknown errors gracefully', async () => {
      const { getDrizzleClient } = await import('@scrimspec/db');
      const mockDb = getDrizzleClient();

      // Throw non-Error object
      selectChain.execute.mockRejectedValueOnce('Unknown error');

      const payload = {
        videoIds: [1, 2, 3],
      };

      const result = await startAnalysis(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });
});
