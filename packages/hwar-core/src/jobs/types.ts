// packages/hwar-core/src/jobs/types.ts

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type JobStage = string;

export interface JobRecord {
    id: string;
    status: JobStatus;
    stage: JobStage;
    retryCount: number;
    externalId: string | null;
    idempotencyKey: string | null;
    // Add other common fields if necessary, e.g., createdAt, updatedAt
    createdAt: Date;
    updatedAt: Date;
}
