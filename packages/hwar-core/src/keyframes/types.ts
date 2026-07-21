import { JobRecord } from '../jobs/types';

export interface KeyframeJob extends JobRecord {
    projectId: string;
    sceneIndex: number;
    frameType: 'first' | 'last';
    prompt: string;
    modelId?: string;
    assetId: string;
    externalId: string | null;
    idempotencyKey: string | null;
}
