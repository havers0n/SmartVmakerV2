import { z } from 'zod';
import { db } from '@/shared/lib/db';
import { storyTemplates, beats } from '@/shared/lib/schema';
import { createLogger } from '@aec/logger';
import { eq } from 'drizzle-orm';

const logger = createLogger({ name: 'api-story-templates' });

/**
 * Validation schemas
 */
export const beatSchema = z.object({
  id: z.string().uuid().optional(),
  order: z.number().int().min(0),
  phase: z.enum(['HOOK', 'BUILD', 'PAYOFF', 'RESOLUTION']),
  durationSeconds: z.number().positive(),
  description: z.string().min(1),
  actionPrompt: z.string().optional(),
  emotion: z.enum([
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
  ]),
  contrast: z
    .enum([
      'small_vs_big',
      'slow_vs_fast',
      'alone_vs_together',
      'sad_vs_happy',
      'problem_vs_solution',
      'before_vs_after',
    ])
    .optional(),
  intendedImpact: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

export const createStoryTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  targetDurationSeconds: z.number().int().positive(),
  beats: z.array(beatSchema).min(1, 'At least one beat is required'),
});

export const updateStoryTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  targetDurationSeconds: z.number().int().positive().optional(),
  beats: z.array(beatSchema).optional(),
});

export const getByIdSchema = z.object({
  id: z.string().uuid(),
});

export const deleteSchema = z.object({
  id: z.string().uuid(),
});

export type CreateStoryTemplatePayload = z.infer<typeof createStoryTemplateSchema>;
export type UpdateStoryTemplatePayload = z.infer<typeof updateStoryTemplateSchema>;
export type GetByIdPayload = z.infer<typeof getByIdSchema>;
export type DeletePayload = z.infer<typeof deleteSchema>;

/**
 * Create a new story template with beats
 */
export async function createStoryTemplate(payload: unknown) {
  const validated = createStoryTemplateSchema.parse(payload);

  logger.info({ name: validated.name }, 'Creating story template');

  return await db.transaction(async (tx) => {
    // Insert story template
    const [template] = await tx
      .insert(storyTemplates)
      .values({
        name: validated.name,
        description: validated.description,
        tags: validated.tags,
        targetDurationSeconds: validated.targetDurationSeconds,
      })
      .returning();

    // Insert beats
    const beatsToInsert = validated.beats.map((beat) => ({
      templateId: template.id,
      order: beat.order,
      phase: beat.phase,
      durationSeconds: String(beat.durationSeconds),
      description: beat.description,
      actionPrompt: beat.actionPrompt,
      emotion: beat.emotion,
      contrast: beat.contrast,
      intendedImpact: beat.intendedImpact,
      meta: beat.meta,
    }));

    const insertedBeats = await tx.insert(beats).values(beatsToInsert).returning();

    logger.info(
      { templateId: template.id, beatsCount: insertedBeats.length },
      'Story template created successfully'
    );

    return {
      ...template,
      beats: insertedBeats,
    };
  });
}

/**
 * List all story templates (without beats)
 */
export async function listStoryTemplates() {
  logger.info('Listing all story templates');

  const templates = await db.select().from(storyTemplates);

  logger.info({ count: templates.length }, 'Story templates retrieved');

  return templates;
}

/**
 * Get story template by ID (with beats)
 */
export async function getStoryTemplateById(payload: unknown) {
  const validated = getByIdSchema.parse(payload);

  logger.info({ id: validated.id }, 'Getting story template by ID');

  const [template] = await db
    .select()
    .from(storyTemplates)
    .where(eq(storyTemplates.id, validated.id));

  if (!template) {
    throw new Error(`Story template with id ${validated.id} not found`);
  }

  // Get beats for this template
  const templateBeats = await db
    .select()
    .from(beats)
    .where(eq(beats.templateId, validated.id))
    .orderBy(beats.order);

  logger.info(
    { templateId: template.id, beatsCount: templateBeats.length },
    'Story template retrieved'
  );

  return {
    ...template,
    beats: templateBeats,
  };
}

/**
 * Update story template (and optionally beats)
 */
export async function updateStoryTemplate(payload: unknown) {
  const validated = updateStoryTemplateSchema.parse(payload);

  logger.info({ id: validated.id }, 'Updating story template');

  return await db.transaction(async (tx) => {
    // Build update object for template
    const updateData: any = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.tags !== undefined) updateData.tags = validated.tags;
    if (validated.targetDurationSeconds !== undefined)
      updateData.targetDurationSeconds = validated.targetDurationSeconds;

    // Only update template if there are changes
    let template;
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date().toISOString();

      [template] = await tx
        .update(storyTemplates)
        .set(updateData)
        .where(eq(storyTemplates.id, validated.id))
        .returning();

      if (!template) {
        throw new Error(`Story template with id ${validated.id} not found`);
      }
    } else {
      // Fetch template if no updates
      [template] = await tx
        .select()
        .from(storyTemplates)
        .where(eq(storyTemplates.id, validated.id));

      if (!template) {
        throw new Error(`Story template with id ${validated.id} not found`);
      }
    }

    // Update beats if provided
    if (validated.beats) {
      // Delete existing beats
      await tx.delete(beats).where(eq(beats.templateId, validated.id));

      // Insert new beats
      if (validated.beats.length > 0) {
        const beatsToInsert = validated.beats.map((beat) => ({
          templateId: validated.id,
          order: beat.order,
          phase: beat.phase,
          durationSeconds: String(beat.durationSeconds),
          description: beat.description,
          actionPrompt: beat.actionPrompt,
          emotion: beat.emotion,
          contrast: beat.contrast,
          intendedImpact: beat.intendedImpact,
          meta: beat.meta,
        }));

        await tx.insert(beats).values(beatsToInsert);
      }
    }

    // Get updated beats
    const updatedBeats = await tx
      .select()
      .from(beats)
      .where(eq(beats.templateId, validated.id))
      .orderBy(beats.order);

    logger.info(
      { templateId: template.id, beatsCount: updatedBeats.length },
      'Story template updated successfully'
    );

    return {
      ...template,
      beats: updatedBeats,
    };
  });
}

/**
 * Delete story template (cascades to beats)
 */
export async function deleteStoryTemplate(payload: unknown) {
  const validated = deleteSchema.parse(payload);

  logger.info({ id: validated.id }, 'Deleting story template');

  const [deleted] = await db
    .delete(storyTemplates)
    .where(eq(storyTemplates.id, validated.id))
    .returning();

  if (!deleted) {
    throw new Error(`Story template with id ${validated.id} not found`);
  }

  logger.info({ templateId: deleted.id }, 'Story template deleted successfully');

  return {
    message: 'Story template deleted successfully',
    id: deleted.id,
  };
}
