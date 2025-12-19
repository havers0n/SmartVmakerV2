/**
 * Tests for story-templates action handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createStoryTemplate,
  listStoryTemplates,
  getStoryTemplateById,
  updateStoryTemplate,
  deleteStoryTemplate,
  createStoryTemplateSchema,
} from './story-templates';

// Mock the database module
var mockDb: any;
var selectChain: any;
var insertChain: any;
var updateChain: any;
var deleteChain: any;

vi.mock('@/shared/lib/db', () => {
  // SELECT chain is thenable: `await db.select().from(...)` works.
  selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    then: (onfulfilled?: any, onrejected?: any) => selectChain.execute().then(onfulfilled, onrejected),
  };

  insertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };

  updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };

  deleteChain = {
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };

  mockDb = {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
    delete: vi.fn(() => deleteChain),
    transaction: vi.fn(),
  };

  return { db: mockDb };
});

// Mock schema tables
vi.mock('@/shared/lib/schema', () => ({
  storyTemplates: {},
  beats: {
    order: {},
  },
}));

// Mock the logger
vi.mock('@aec/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('Story Templates Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Schema Validation', () => {
    it('should validate createStoryTemplate payload', () => {
      const validPayload = {
        name: 'Epic Journey',
        description: 'A hero\'s journey template',
        tags: ['adventure', 'hero'],
        targetDurationSeconds: 60,
        beats: [
          {
            order: 0,
            phase: 'HOOK' as const,
            durationSeconds: 10,
            description: 'Opening scene',
            emotion: 'curiosity' as const,
          },
        ],
      };

      const result = createStoryTemplateSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject template without name', () => {
      const invalidPayload = {
        name: '',
        targetDurationSeconds: 60,
        beats: [],
      };

      const result = createStoryTemplateSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject template without beats', () => {
      const invalidPayload = {
        name: 'Test Template',
        targetDurationSeconds: 60,
        beats: [],
      };

      const result = createStoryTemplateSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should validate beat with all optional fields', () => {
      const validPayload = {
        name: 'Complex Template',
        targetDurationSeconds: 120,
        beats: [
          {
            order: 0,
            phase: 'BUILD' as const,
            durationSeconds: 30,
            description: 'Build tension',
            actionPrompt: 'Show character struggling',
            emotion: 'tension' as const,
            contrast: 'small_vs_big' as const,
            intendedImpact: 'Create suspense',
            meta: { custom: 'value' },
          },
        ],
      };

      const result = createStoryTemplateSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });

  describe('createStoryTemplate', () => {
    it('should create story template with beats', async () => {
      const { db } = await import('@/shared/lib/db');
      const mockTemplate = {
        id: 'template-uuid-1',
        name: 'Epic Journey',
        description: 'A hero\'s journey',
        tags: ['adventure'],
        targetDurationSeconds: 60,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockBeats = [
        {
          id: 'beat-uuid-1',
          templateId: 'template-uuid-1',
          order: 0,
          phase: 'HOOK',
          durationSeconds: '10',
          description: 'Opening',
          emotion: 'curiosity',
        },
      ];

      // Mock transaction
      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn()
            .mockResolvedValueOnce([mockTemplate])
            .mockResolvedValueOnce(mockBeats),
        };
        return callback(mockTx);
      });

      const payload = {
        name: 'Epic Journey',
        description: 'A hero\'s journey',
        tags: ['adventure'],
        targetDurationSeconds: 60,
        beats: [
          {
            order: 0,
            phase: 'HOOK' as const,
            durationSeconds: 10,
            description: 'Opening',
            emotion: 'curiosity' as const,
          },
        ],
      };

      const result = await createStoryTemplate(payload);

      expect(result).toEqual({
        ...mockTemplate,
        beats: mockBeats,
      });
    });

    it('should throw error for invalid payload', async () => {
      const invalidPayload = {
        name: '',
        targetDurationSeconds: 60,
        beats: [],
      };

      await expect(createStoryTemplate(invalidPayload)).rejects.toThrow();
    });
  });

  describe('listStoryTemplates', () => {
    it('should list all story templates', async () => {
      const mockTemplates = [
        {
          id: 'template-uuid-1',
          name: 'Template 1',
          targetDurationSeconds: 60,
        },
        {
          id: 'template-uuid-2',
          name: 'Template 2',
          targetDurationSeconds: 90,
        },
      ];

      selectChain.execute.mockResolvedValueOnce(mockTemplates);

      const result = await listStoryTemplates();

      expect(result).toEqual(mockTemplates);
      expect(mockDb.select).toHaveBeenCalled();
      expect(selectChain.from).toHaveBeenCalled();
    });

    it('should return empty array when no templates exist', async () => {
      selectChain.execute.mockResolvedValueOnce([]);

      const result = await listStoryTemplates();

      expect(result).toEqual([]);
    });
  });

  describe('getStoryTemplateById', () => {
    it('should get template with beats by ID', async () => {
      const mockTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Template 1',
        targetDurationSeconds: 60,
      };

      const mockBeats = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          templateId: '550e8400-e29b-41d4-a716-446655440000',
          order: 0,
          phase: 'HOOK',
          description: 'Opening',
          emotion: 'curiosity',
        },
      ];

      selectChain.execute
        .mockResolvedValueOnce([mockTemplate])
        .mockResolvedValueOnce(mockBeats);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = await getStoryTemplateById(payload);

      expect(result).toEqual({
        ...mockTemplate,
        beats: mockBeats,
      });
    });

    it('should throw error when template not found', async () => {
      selectChain.execute.mockResolvedValueOnce([]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440002',
      };

      await expect(getStoryTemplateById(payload)).rejects.toThrow('not found');
    });

    it('should throw error for invalid UUID', async () => {
      const payload = {
        id: 'invalid-uuid',
      };

      await expect(getStoryTemplateById(payload)).rejects.toThrow();
    });
  });

  describe('updateStoryTemplate', () => {
    it('should update template and beats', async () => {
      const { db } = await import('@/shared/lib/db');
      const mockTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Updated Template',
        targetDurationSeconds: 90,
        updatedAt: new Date().toISOString(),
      };

      const mockBeats = [
        {
          id: '550e8400-e29b-41d4-a716-446655440004',
          templateId: '550e8400-e29b-41d4-a716-446655440003',
          order: 0,
          phase: 'HOOK',
          description: 'Updated opening',
          emotion: 'curiosity',
        },
      ];

      // Mock transaction
      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockDeleteChain = {
          where: vi.fn().mockResolvedValue(undefined),
        };
        const mockInsertChain = {
          values: vi.fn().mockResolvedValue(undefined),
        };
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([mockTemplate]),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue(mockDeleteChain),
          insert: vi.fn().mockReturnValue(mockInsertChain),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockBeats),
              }),
            }),
          }),
        };
        return callback(mockTx);
      });

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Updated Template',
        targetDurationSeconds: 90,
        beats: [
          {
            order: 0,
            phase: 'HOOK' as const,
            durationSeconds: 15,
            description: 'Updated opening',
            emotion: 'curiosity' as const,
          },
        ],
      };

      const result = await updateStoryTemplate(payload);

      expect(result).toEqual({
        ...mockTemplate,
        beats: mockBeats,
      });
    });

    it('should update only template fields without beats', async () => {
      const { db } = await import('@/shared/lib/db');
      const mockTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        name: 'Updated Name',
        targetDurationSeconds: 60,
      };

      const mockBeats = [
        {
          id: '550e8400-e29b-41d4-a716-446655440006',
          templateId: '550e8400-e29b-41d4-a716-446655440005',
          order: 0,
          phase: 'HOOK',
          description: 'Opening',
          emotion: 'curiosity',
        },
      ];

      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([mockTemplate]),
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue(mockBeats),
        };
        return callback(mockTx);
      });

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        name: 'Updated Name',
      };

      const result = await updateStoryTemplate(payload);

      expect(result).toEqual({
        ...mockTemplate,
        beats: mockBeats,
      });
    });

    it('should throw error when template not found', async () => {
      const { db } = await import('@/shared/lib/db');

      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([]),
        };
        return callback(mockTx);
      });

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440007',
        name: 'Updated Name',
      };

      await expect(updateStoryTemplate(payload)).rejects.toThrow('not found');
    });
  });

  describe('deleteStoryTemplate', () => {
    it('should delete story template', async () => {
      const mockDeleted = {
        id: '550e8400-e29b-41d4-a716-446655440008',
        name: 'Deleted Template',
      };

      deleteChain.returning.mockResolvedValueOnce([mockDeleted]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440008',
      };

      const result = await deleteStoryTemplate(payload);

      expect(result).toEqual({
        message: 'Story template deleted successfully',
        id: mockDeleted.id,
      });
    });

    it('should throw error when template not found', async () => {
      deleteChain.returning.mockResolvedValueOnce([]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440009',
      };

      await expect(deleteStoryTemplate(payload)).rejects.toThrow('not found');
    });
  });

  describe('Beat Validation', () => {
    it('should accept all valid phase values', () => {
      const phases = ['HOOK', 'BUILD', 'PAYOFF', 'RESOLUTION'] as const;

      phases.forEach((phase) => {
        const payload = {
          name: 'Test',
          targetDurationSeconds: 60,
          beats: [
            {
              order: 0,
              phase,
              durationSeconds: 10,
              description: 'Test beat',
              emotion: 'joy' as const,
            },
          ],
        };

        const result = createStoryTemplateSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });

    it('should accept all valid emotion values', () => {
      const emotions = [
        'joy',
        'sadness',
        'surprise',
        'anticipation',
        'tension',
        'relief',
        'empathy',
        'curiosity',
        'humor',
        'awe',
      ] as const;

      emotions.forEach((emotion) => {
        const payload = {
          name: 'Test',
          targetDurationSeconds: 60,
          beats: [
            {
              order: 0,
              phase: 'HOOK' as const,
              durationSeconds: 10,
              description: 'Test beat',
              emotion,
            },
          ],
        };

        const result = createStoryTemplateSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });

    it('should accept all valid contrast values', () => {
      const contrasts = [
        'small_vs_big',
        'slow_vs_fast',
        'alone_vs_together',
        'sad_vs_happy',
        'problem_vs_solution',
        'before_vs_after',
      ] as const;

      contrasts.forEach((contrast) => {
        const payload = {
          name: 'Test',
          targetDurationSeconds: 60,
          beats: [
            {
              order: 0,
              phase: 'HOOK' as const,
              durationSeconds: 10,
              description: 'Test beat',
              emotion: 'joy' as const,
              contrast,
            },
          ],
        };

        const result = createStoryTemplateSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });
  });
});
