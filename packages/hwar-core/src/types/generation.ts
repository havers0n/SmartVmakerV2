export type AnimationJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface AnimationJobDto {
    id: string;
    projectId: string;
    sceneIndex: number | null;
    provider: 'minimax';
    minimaxTaskId: string | null;
    status: AnimationJobStatus;
    videoUrl: string | null;
    durationSeconds: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
    lastSyncAt: string | null;
}

export interface AnimationOverviewResponse {
    projectId: string;
    overallStatus: AnimationJobStatus | 'idle';
    jobs: AnimationJobDto[];
}

