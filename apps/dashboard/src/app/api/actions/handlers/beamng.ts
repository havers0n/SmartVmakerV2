import { z } from 'zod';
import { importBeamngChannel } from '@/shared/lib/beamng-channel-service';
import { createLogger } from '@aec/logger';

const logger = createLogger({ name: 'api-beamng' });

export const importChannelPayloadSchema = z.object({
  input: z.string().min(1, 'Channel input is required'),
  maxVideos: z.number().min(1).max(200).default(50),
});

export type ImportChannelPayload = z.infer<typeof importChannelPayloadSchema>;

export async function importChannel(payload: unknown) {
  const validated = importChannelPayloadSchema.parse(payload);

  logger.info({ input: validated.input, maxVideos: validated.maxVideos }, 'Importing channel');

  const result = await importBeamngChannel(validated.input, validated.maxVideos);

  logger.info(
    { channelTitle: result.channelTitle, videosImported: result.videosImported },
    'Channel import completed',
  );

  return result;
}
