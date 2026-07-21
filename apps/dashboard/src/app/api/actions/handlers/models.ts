import { db } from '@/shared/lib/db';
import { aiModels, aiProviders } from '@/shared/lib/schema';
import { createLogger } from '@aec/logger';
import { eq, and, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

const logger = createLogger({ name: 'api-models' });

const listModelsSchema = z.object({
  type: z.enum([
    'text-to-text',
    'text-to-image',
    'image-to-video',
    'text-to-video',
    'image-to-image',
    'audio-to-text',
    'text-to-audio',
    'multimodal'
  ]),
});

export type ModelType = z.infer<typeof listModelsSchema>['type'];

export interface ModelWithProvider {
  id: string;
  name: string;
  type: ModelType;
  providerId: string;
  providerName: string;
  isDefault: boolean;
  isEnabled: boolean;
  capabilities: string[] | null;
  costDetails: unknown;
  metadata: unknown;
}

/**
 * List AI models by type with their provider information
 *
 * @param payload - Contains the model type to filter by
 * @returns Array of models with provider details
 */
export async function listModels(payload: unknown): Promise<ModelWithProvider[]> {
  const validated = listModelsSchema.parse(payload);

  logger.info({ type: validated.type }, 'Listing AI models by type');

  try {
    // Join ai_models with ai_providers to get provider info
    const models = await db
      .select({
        id: aiModels.id,
        name: aiModels.name,
        type: aiModels.type,
        providerId: aiModels.providerId,
        providerName: aiProviders.name,
        isDefault: aiModels.isDefault,
        isEnabled: aiModels.isEnabled,
        capabilities: aiModels.capabilities,
        costDetails: aiModels.costDetails,
        metadata: aiModels.metadata,
      })
      .from(aiModels)
      .innerJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
      .where(
        and(
          eq(aiModels.type, validated.type),
          eq(aiModels.isEnabled, true)
        )
      )
      .orderBy(desc(aiModels.isDefault), asc(aiModels.name));

    logger.info({ count: models.length, type: validated.type }, 'Models retrieved successfully');

    return models as ModelWithProvider[];
  } catch (error) {
    logger.error({ error, type: validated.type }, 'Failed to list models');
    throw error;
  }
}
