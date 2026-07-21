/**
 * Tests for ingest action handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startSearch, startSearchPayloadSchema } from './ingest';

// Mock the database module
var mockDb: any;
var insertChain: any;

vi.mock('@/shared/lib/db', () => {
  insertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };

  mockDb = {
    insert: vi.fn(() => insertChain),
  };

  return { db: mockDb };
});

// Mock the logger
vi.mock('@aec/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('startSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should validate payload with startSearchPayloadSchema', () => {
      const validPayload = {
        query: 'test query',
        maxResults: 25,
      };

      const result = startSearchPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject query shorter than 3 characters', () => {
      const invalidPayload = {
        query: 'ab', // Too short
      };

      const result = startSearchPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('at least 3 characters');
      }
    });

    it('should reject invalid order parameter', () => {
      const invalidPayload = {
        query: 'test query',
        order: 'invalid' as any,
      };

      const result = startSearchPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should accept optional parameters', () => {
      const validPayload = {
        query: 'test query',
        order: 'relevance' as const,
        videoDuration: 'short' as const,
        maxResults: 10,
        safeSearch: 'strict' as const,
      };

      const result = startSearchPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject maxResults outside valid range', () => {
      const invalidPayload = {
        query: 'test query',
        maxResults: 100, // Too large (max is 50)
      };

      const result = startSearchPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('Job Creation', () => {
    it('should create ingest job with valid payload', async () => {
      const mockJob = {
        id: 1,
        query: 'test query',
        status: 'pending',
        max_results: 25,
      };

      // Setup mock to return the job
      insertChain.returning.mockResolvedValueOnce([mockJob]);

      const payload = {
        query: 'test query',
        maxResults: 25,
      };

      const result = await startSearch(payload);

      // Verify database was called correctly
      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
          maxResults: 25,
          status: 'pending',
        })
      );

      // Verify result
      expect(result).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('test query'),
          jobId: 1,
          status: 'pending',
        })
      );
    });

    it('should set default values for optional parameters', async () => {
      const mockJob = {
        id: 2,
        query: 'minimal query',
        status: 'pending',
      };

      insertChain.returning.mockResolvedValueOnce([mockJob]);

      const payload = {
        query: 'minimal query',
      };

      await startSearch(payload);

      // Verify defaults were applied
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          maxResults: 25, // Default value
          orderBy: 'date', // Default value
          safeSearch: 'moderate', // Default value
        })
      );
    });

    it('should handle published_after date formatting', async () => {
      const mockJob = { id: 3, status: 'pending' };

      insertChain.returning.mockResolvedValueOnce([mockJob]);

      const payload = {
        query: 'test query',
        publishedAfter: '2024-01-01',
      };

      await startSearch(payload);

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          publishedAfter: expect.stringContaining('2024-01-01'),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid payload', async () => {
      const invalidPayload = {
        query: 'ab', // Too short
      };

      await expect(startSearch(invalidPayload)).rejects.toThrow();
    });

    it('should propagate database errors', async () => {
      insertChain.returning.mockRejectedValueOnce(new Error('Database error'));

      const payload = {
        query: 'test query',
      };

      await expect(startSearch(payload)).rejects.toThrow('Database error');
    });
  });

  describe('All YouTube API Parameters', () => {
    it('should pass all supported YouTube API parameters', async () => {
      const mockJob = { id: 4, status: 'pending' };

      insertChain.returning.mockResolvedValueOnce([mockJob]);

      const payload = {
        query: 'comprehensive test',
        order: 'viewCount' as const,
        videoDuration: 'medium' as const,
        maxResults: 30,
        publishedAfter: '2024-01-01',
        safeSearch: 'strict' as const,
        videoDefinition: 'high' as const,
        regionCode: 'US',
        relevanceLanguage: 'en',
        videoCaption: 'closedCaption' as const,
        videoEmbeddable: true,
        videoLicense: 'creativeCommon' as const,
        eventType: 'completed' as const,
      };

      await startSearch(payload);

      // Verify all parameters were passed
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'comprehensive test',
          orderBy: 'viewCount',
          videoDuration: 'medium',
          maxResults: 30,
          publishedAfter: expect.any(String),
          safeSearch: 'strict',
          videoDefinition: 'high',
          regionCode: 'US',
          relevanceLanguage: 'en',
          videoCaption: 'closedCaption',
          videoEmbeddable: true,
          videoLicense: 'creativeCommon',
          eventType: 'completed',
        })
      );
    });
  });
});
