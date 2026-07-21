/**
 * Tests for characters action handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCharacter,
  listCharacters,
  getCharacterById,
  updateCharacter,
  deleteCharacter,
  createCharacterSchema,
} from './characters';

// Mock the database module
var mockDb: any;
var selectChain: any;
var insertChain: any;
var updateChain: any;
var deleteChain: any;

vi.mock('@/shared/lib/db', () => {
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
  characters: {},
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

describe('Characters Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Schema Validation', () => {
    it('should validate createCharacter payload', () => {
      const validPayload = {
        name: 'Fluffy Corgi',
        description: 'A cute fluffy corgi puppy',
        stylePresets: {
          base_prompt: 'cute puppy, corgi, fluffy',
          negative_prompt: 'blurry, ugly',
        },
        referenceImageUrls: ['https://example.com/image.jpg'],
      };

      const result = createCharacterSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject character without name', () => {
      const invalidPayload = {
        name: '',
        description: 'Test',
      };

      const result = createCharacterSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should accept minimal character payload', () => {
      const validPayload = {
        name: 'Simple Character',
      };

      const result = createCharacterSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL in referenceImageUrls', () => {
      const invalidPayload = {
        name: 'Test Character',
        referenceImageUrls: ['not-a-url', 'also-not-url'],
      };

      const result = createCharacterSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should accept valid URLs in referenceImageUrls', () => {
      const validPayload = {
        name: 'Test Character',
        referenceImageUrls: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.png',
        ],
      };

      const result = createCharacterSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });

  describe('createCharacter', () => {
    it('should create character with all fields', async () => {
      const mockCharacter = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        name: 'Fluffy Corgi',
        description: 'A cute fluffy corgi puppy',
        stylePresets: {
          base_prompt: 'cute puppy, corgi, fluffy',
        },
        referenceImageUrls: ['https://example.com/corgi.jpg'],
        ownerId: '550e8400-e29b-41d4-a716-446655440020',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      insertChain.returning.mockResolvedValueOnce([mockCharacter]);

      const payload = {
        name: 'Fluffy Corgi',
        description: 'A cute fluffy corgi puppy',
        stylePresets: {
          base_prompt: 'cute puppy, corgi, fluffy',
        },
        referenceImageUrls: ['https://example.com/corgi.jpg'],
        ownerId: '550e8400-e29b-41d4-a716-446655440020',
      };

      const result = await createCharacter(payload);

      expect(result).toEqual(mockCharacter);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Fluffy Corgi',
          description: 'A cute fluffy corgi puppy',
          stylePresets: expect.any(Object),
          referenceImageUrls: expect.any(Array),
        })
      );
    });

    it('should create character with minimal fields', async () => {
      const mockCharacter = {
        id: '550e8400-e29b-41d4-a716-446655440011',
        name: 'Simple Character',
        description: null,
        stylePresets: {},
        referenceImageUrls: null,
        ownerId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      insertChain.returning.mockResolvedValueOnce([mockCharacter]);

      const payload = {
        name: 'Simple Character',
      };

      const result = await createCharacter(payload);

      expect(result).toEqual(mockCharacter);
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Simple Character',
          stylePresets: {},
        })
      );
    });

    it('should throw error for invalid payload', async () => {
      const invalidPayload = {
        name: '',
      };

      await expect(createCharacter(invalidPayload)).rejects.toThrow();
    });

    it('should propagate database errors', async () => {
      insertChain.returning.mockRejectedValueOnce(new Error('Database error'));

      const payload = {
        name: 'Test Character',
      };

      await expect(createCharacter(payload)).rejects.toThrow('Database error');
    });
  });

  describe('listCharacters', () => {
    it('should list all characters', async () => {
      const mockCharacters = [
        {
          id: '550e8400-e29b-41d4-a716-446655440012',
          name: 'Character 1',
          description: 'First character',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440013',
          name: 'Character 2',
          description: 'Second character',
        },
      ];

      selectChain.execute.mockResolvedValueOnce(mockCharacters);

      const result = await listCharacters();

      expect(result).toEqual(mockCharacters);
      expect(mockDb.select).toHaveBeenCalled();
      expect(selectChain.from).toHaveBeenCalled();
    });

    it('should return empty array when no characters exist', async () => {
      selectChain.execute.mockResolvedValueOnce([]);

      const result = await listCharacters();

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      selectChain.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(listCharacters()).rejects.toThrow('Database error');
    });
  });

  describe('getCharacterById', () => {
    it('should get character by ID', async () => {
      const mockCharacter = {
        id: '550e8400-e29b-41d4-a716-446655440014',
        name: 'Character 1',
        description: 'First character',
        stylePresets: { base: 'test' },
        referenceImageUrls: ['https://example.com/image.jpg'],
      };

      selectChain.execute.mockResolvedValueOnce([mockCharacter]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440014',
      };

      const result = await getCharacterById(payload);

      expect(result).toEqual(mockCharacter);
      expect(mockDb.select).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should throw error when character not found', async () => {
      selectChain.execute.mockResolvedValueOnce([]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440015',
      };

      await expect(getCharacterById(payload)).rejects.toThrow('not found');
    });

    it('should throw error for invalid UUID', async () => {
      const payload = {
        id: 'invalid-uuid',
      };

      await expect(getCharacterById(payload)).rejects.toThrow();
    });
  });

  describe('updateCharacter', () => {
    it('should update character with all fields', async () => {
      const mockCharacter = {
        id: '550e8400-e29b-41d4-a716-446655440016',
        name: 'Updated Character',
        description: 'Updated description',
        stylePresets: { updated: 'preset' },
        referenceImageUrls: ['https://example.com/new.jpg'],
        updatedAt: new Date().toISOString(),
      };

      updateChain.returning.mockResolvedValueOnce([mockCharacter]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440016',
        name: 'Updated Character',
        description: 'Updated description',
        stylePresets: { updated: 'preset' },
        referenceImageUrls: ['https://example.com/new.jpg'],
      };

      const result = await updateCharacter(payload);

      expect(result).toEqual(mockCharacter);
      expect(mockDb.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Character',
          description: 'Updated description',
          updatedAt: expect.any(String),
        })
      );
    });

    it('should update only specified fields', async () => {
      const mockCharacter = {
        id: '550e8400-e29b-41d4-a716-446655440017',
        name: 'Updated Name',
        description: 'Original description',
        updatedAt: new Date().toISOString(),
      };

      updateChain.returning.mockResolvedValueOnce([mockCharacter]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440017',
        name: 'Updated Name',
      };

      const result = await updateCharacter(payload);

      expect(result).toEqual(mockCharacter);
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          updatedAt: expect.any(String),
        })
      );
    });

    it('should throw error when character not found', async () => {
      updateChain.returning.mockResolvedValueOnce([]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440018',
        name: 'Updated Name',
      };

      await expect(updateCharacter(payload)).rejects.toThrow('not found');
    });

    it('should throw error for invalid payload', async () => {
      const invalidPayload = {
        id: '550e8400-e29b-41d4-a716-446655440019',
        name: '', // Empty name
      };

      await expect(updateCharacter(invalidPayload)).rejects.toThrow();
    });
  });

  describe('deleteCharacter', () => {
    it('should delete character', async () => {
      const mockDeleted = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        name: 'Deleted Character',
      };

      deleteChain.returning.mockResolvedValueOnce([mockDeleted]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440021',
      };

      const result = await deleteCharacter(payload);

      expect(result).toEqual({
        message: 'Character deleted successfully',
        id: mockDeleted.id,
      });
      expect(mockDb.delete).toHaveBeenCalled();
      expect(deleteChain.where).toHaveBeenCalled();
    });

    it('should throw error when character not found', async () => {
      deleteChain.returning.mockResolvedValueOnce([]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440022',
      };

      await expect(deleteCharacter(payload)).rejects.toThrow('not found');
    });

    it('should throw error for invalid UUID', async () => {
      const payload = {
        id: 'invalid-uuid',
      };

      await expect(deleteCharacter(payload)).rejects.toThrow();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle character with multiple reference images', async () => {
      const mockCharacter = {
        id: 'character-uuid-1',
        name: 'Multi-Ref Character',
        referenceImageUrls: [
          'https://example.com/front.jpg',
          'https://example.com/side.jpg',
          'https://example.com/back.jpg',
        ],
      };

      insertChain.returning.mockResolvedValueOnce([mockCharacter]);

      const payload = {
        name: 'Multi-Ref Character',
        referenceImageUrls: [
          'https://example.com/front.jpg',
          'https://example.com/side.jpg',
          'https://example.com/back.jpg',
        ],
      };

      const result = await createCharacter(payload);

      expect(result.referenceImageUrls).toHaveLength(3);
    });

    it('should handle complex stylePresets object', async () => {
      const complexStylePresets = {
        base_prompt: 'detailed character, high quality',
        negative_prompt: 'blurry, low quality',
        style: 'photorealistic',
        lighting: 'natural',
        custom_params: {
          cfg_scale: 7,
          steps: 50,
        },
      };

      const mockCharacter = {
        id: 'character-uuid-1',
        name: 'Complex Character',
        stylePresets: complexStylePresets,
      };

      insertChain.returning.mockResolvedValueOnce([mockCharacter]);

      const payload = {
        name: 'Complex Character',
        stylePresets: complexStylePresets,
      };

      const result = await createCharacter(payload);

      expect(result.stylePresets).toEqual(complexStylePresets);
    });
  });
});
