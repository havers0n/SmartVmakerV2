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
  updateCharacterSchema,
  getByIdSchema,
  deleteSchema,
} from './characters';

// Mock the database module
vi.mock('@/shared/lib/db', () => {
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };
  return {
    db: mockDb,
  };
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
      const { db } = await import('@/shared/lib/db');
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

      (db.insert as any).mockReturnThis();
      (db.values as any).mockReturnThis();
      (db.returning as any).mockResolvedValue([mockCharacter]);

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
      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Fluffy Corgi',
          description: 'A cute fluffy corgi puppy',
          stylePresets: expect.any(Object),
          referenceImageUrls: expect.any(Array),
        })
      );
    });

    it('should create character with minimal fields', async () => {
      const { db } = await import('@/shared/lib/db');
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

      (db.insert as any).mockReturnThis();
      (db.values as any).mockReturnThis();
      (db.returning as any).mockResolvedValue([mockCharacter]);

      const payload = {
        name: 'Simple Character',
      };

      const result = await createCharacter(payload);

      expect(result).toEqual(mockCharacter);
      expect(db.values).toHaveBeenCalledWith(
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
      const { db } = await import('@/shared/lib/db');

      (db.insert as any).mockReturnThis();
      (db.values as any).mockReturnThis();
      (db.returning as any).mockRejectedValue(new Error('Database error'));

      const payload = {
        name: 'Test Character',
      };

      await expect(createCharacter(payload)).rejects.toThrow('Database error');
    });
  });

  describe('listCharacters', () => {
    it('should list all characters', async () => {
      const { db } = await import('@/shared/lib/db');
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

      (db.select as any).mockReturnThis();
      (db.from as any).mockResolvedValue(mockCharacters);

      const result = await listCharacters();

      expect(result).toEqual(mockCharacters);
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalled();
    });

    it('should return empty array when no characters exist', async () => {
      const { db } = await import('@/shared/lib/db');

      (db.select as any).mockReturnThis();
      (db.from as any).mockResolvedValue([]);

      const result = await listCharacters();

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      const { db } = await import('@/shared/lib/db');

      (db.select as any).mockReturnThis();
      (db.from as any).mockRejectedValue(new Error('Database error'));

      await expect(listCharacters()).rejects.toThrow('Database error');
    });
  });

  describe('getCharacterById', () => {
    it('should get character by ID', async () => {
      const { db } = await import('@/shared/lib/db');
      const mockCharacter = {
        id: '550e8400-e29b-41d4-a716-446655440014',
        name: 'Character 1',
        description: 'First character',
        stylePresets: { base: 'test' },
        referenceImageUrls: ['https://example.com/image.jpg'],
      };

      (db.select as any).mockReturnThis();
      (db.from as any).mockReturnThis();
      (db.where as any).mockResolvedValue([mockCharacter]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440014',
      };

      const result = await getCharacterById(payload);

      expect(result).toEqual(mockCharacter);
      expect(db.select).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
    });

    it('should throw error when character not found', async () => {
      const { db } = await import('@/shared/lib/db');

      (db.select as any).mockReturnThis();
      (db.from as any).mockReturnThis();
      (db.where as any).mockResolvedValue([]);

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
      const { db } = await import('@/shared/lib/db');
      const mockCharacter = {
        id: '550e8400-e29b-41d4-a716-446655440016',
        name: 'Updated Character',
        description: 'Updated description',
        stylePresets: { updated: 'preset' },
        referenceImageUrls: ['https://example.com/new.jpg'],
        updatedAt: new Date().toISOString(),
      };

      (db.update as any).mockReturnThis();
      (db.set as any).mockReturnThis();
      (db.where as any).mockReturnThis();
      (db.returning as any).mockResolvedValue([mockCharacter]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440016',
        name: 'Updated Character',
        description: 'Updated description',
        stylePresets: { updated: 'preset' },
        referenceImageUrls: ['https://example.com/new.jpg'],
      };

      const result = await updateCharacter(payload);

      expect(result).toEqual(mockCharacter);
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Character',
          description: 'Updated description',
          updatedAt: expect.any(String),
        })
      );
    });

    it('should update only specified fields', async () => {
      const { db } = await import('@/shared/lib/db');
      const mockCharacter = {
        id: '550e8400-e29b-41d4-a716-446655440017',
        name: 'Updated Name',
        description: 'Original description',
        updatedAt: new Date().toISOString(),
      };

      (db.update as any).mockReturnThis();
      (db.set as any).mockReturnThis();
      (db.where as any).mockReturnThis();
      (db.returning as any).mockResolvedValue([mockCharacter]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440017',
        name: 'Updated Name',
      };

      const result = await updateCharacter(payload);

      expect(result).toEqual(mockCharacter);
      expect(db.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          updatedAt: expect.any(String),
        })
      );
    });

    it('should throw error when character not found', async () => {
      const { db } = await import('@/shared/lib/db');

      (db.update as any).mockReturnThis();
      (db.set as any).mockReturnThis();
      (db.where as any).mockReturnThis();
      (db.returning as any).mockResolvedValue([]);

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
      const { db } = await import('@/shared/lib/db');
      const mockDeleted = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        name: 'Deleted Character',
      };

      (db.delete as any).mockReturnThis();
      (db.where as any).mockReturnThis();
      (db.returning as any).mockResolvedValue([mockDeleted]);

      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440021',
      };

      const result = await deleteCharacter(payload);

      expect(result).toEqual({
        message: 'Character deleted successfully',
        id: mockDeleted.id,
      });
      expect(db.delete).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
    });

    it('should throw error when character not found', async () => {
      const { db } = await import('@/shared/lib/db');

      (db.delete as any).mockReturnThis();
      (db.where as any).mockReturnThis();
      (db.returning as any).mockResolvedValue([]);

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
      const { db } = await import('@/shared/lib/db');
      const mockCharacter = {
        id: 'character-uuid-1',
        name: 'Multi-Ref Character',
        referenceImageUrls: [
          'https://example.com/front.jpg',
          'https://example.com/side.jpg',
          'https://example.com/back.jpg',
        ],
      };

      (db.insert as any).mockReturnThis();
      (db.values as any).mockReturnThis();
      (db.returning as any).mockResolvedValue([mockCharacter]);

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
      const { db } = await import('@/shared/lib/db');
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

      (db.insert as any).mockReturnThis();
      (db.values as any).mockReturnThis();
      (db.returning as any).mockResolvedValue([mockCharacter]);

      const payload = {
        name: 'Complex Character',
        stylePresets: complexStylePresets,
      };

      const result = await createCharacter(payload);

      expect(result.stylePresets).toEqual(complexStylePresets);
    });
  });
});
