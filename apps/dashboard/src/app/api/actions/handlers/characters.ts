import { z } from 'zod';
import { db } from '@/shared/lib/db';
import { characters } from '@/shared/lib/schema';
import { createLogger } from '@aec/logger';
import { eq, or, isNull, and } from 'drizzle-orm';

const logger = createLogger({ name: 'api-characters' });

/**
 * Validation schemas
 */
export const createCharacterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  stylePresets: z.record(z.unknown()).optional(),
  referenceImageUrls: z.array(z.string().url()).optional(),
  ownerId: z.string().uuid().optional(),
});

export const updateCharacterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  stylePresets: z.record(z.unknown()).optional(),
  referenceImageUrls: z.array(z.string().url()).optional(),
  ownerId: z.string().uuid().optional(),
});

export const getByIdSchema = z.object({
  id: z.string().uuid(),
});

export const deleteSchema = z.object({
  id: z.string().uuid(),
});

export type CreateCharacterPayload = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterPayload = z.infer<typeof updateCharacterSchema>;
export type GetByIdPayload = z.infer<typeof getByIdSchema>;
export type DeletePayload = z.infer<typeof deleteSchema>;

/**
 * Create a new character
 */
export async function createCharacter(
  payload: unknown,
  ctx?: { userId?: string }
) {
  const userId = ctx?.userId;
  if (!userId) throw new Error('Unauthorized');

  const validated = createCharacterSchema.parse(payload);

  logger.info({ name: validated.name }, 'Creating character');

  const [character] = await db
    .insert(characters)
    .values({
      name: validated.name,
      description: validated.description,
      stylePresets: validated.stylePresets || {},
      referenceImageUrls: validated.referenceImageUrls,
      ownerId: userId,
    })
    .returning();

  logger.info({ characterId: character.id }, 'Character created successfully');

  return character;
}

/**
 * List all characters
 */
export async function listCharacters(
  _payload?: unknown,
  ctx?: { userId?: string }
) {
  const userId = ctx?.userId;
  if (!userId) throw new Error('Unauthorized');

  logger.info('Listing all characters');

  const allCharacters = await db
    .select()
    .from(characters)
    .where(or(eq(characters.ownerId, userId), isNull(characters.ownerId)));

  logger.info({ count: allCharacters.length }, 'Characters retrieved');

  return allCharacters;
}

/**
 * Get character by ID
 */
export async function getCharacterById(
  payload: unknown,
  ctx?: { userId?: string }
) {
  const userId = ctx?.userId;
  if (!userId) throw new Error('Unauthorized');

  const validated = getByIdSchema.parse(payload);

  logger.info({ id: validated.id }, 'Getting character by ID');

  const [character] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, validated.id), eq(characters.ownerId, userId)));

  if (!character) {
    throw new Error(`Character with id ${validated.id} not found`);
  }

  logger.info({ characterId: character.id }, 'Character retrieved');

  return character;
}

/**
 * Update character
 */
export async function updateCharacter(
  payload: unknown,
  ctx?: { userId?: string }
) {
  const userId = ctx?.userId;
  if (!userId) throw new Error('Unauthorized');

  const validated = updateCharacterSchema.parse(payload);

  logger.info({ id: validated.id }, 'Updating character');

  // Build update object
  const updateData: any = {
    updatedAt: new Date().toISOString(),
  };

  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.description !== undefined) updateData.description = validated.description;
  if (validated.stylePresets !== undefined) updateData.stylePresets = validated.stylePresets;
  if (validated.referenceImageUrls !== undefined)
    updateData.referenceImageUrls = validated.referenceImageUrls;
  updateData.ownerId = userId;

  const [character] = await db
    .update(characters)
    .set(updateData)
    .where(and(eq(characters.id, validated.id), eq(characters.ownerId, userId)))
    .returning();

  if (!character) {
    throw new Error(`Character with id ${validated.id} not found`);
  }

  logger.info({ characterId: character.id }, 'Character updated successfully');

  return character;
}

/**
 * Delete character
 */
export async function deleteCharacter(
  payload: unknown,
  ctx?: { userId?: string }
) {
  const userId = ctx?.userId;
  if (!userId) throw new Error('Unauthorized');

  const validated = deleteSchema.parse(payload);

  logger.info({ id: validated.id }, 'Deleting character');

  const [deleted] = await db
    .delete(characters)
    .where(and(eq(characters.id, validated.id), eq(characters.ownerId, userId)))
    .returning();

  if (!deleted) {
    throw new Error(`Character with id ${validated.id} not found`);
  }

  logger.info({ characterId: deleted.id }, 'Character deleted successfully');

  return {
    message: 'Character deleted successfully',
    id: deleted.id,
  };
}
