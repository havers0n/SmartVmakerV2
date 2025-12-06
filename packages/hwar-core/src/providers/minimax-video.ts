const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY!;
// Official docs use api.minimax.io; allow override via env.
const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io';

type MiniMaxBaseResp = {
    status_code: number;
    status_msg: string;
};

export type MiniMaxVideoTaskResponse = {
    task_id?: string;
    base_resp: MiniMaxBaseResp;
};

export type MiniMaxVideoStatus =
    | 'Preparing'
    | 'Queueing'
    | 'Processing'
    | 'Success'
    | 'Fail';

export type MiniMaxVideoQueryResponse = {
    task_id: string;
    status: MiniMaxVideoStatus;
    file_id?: string;
    video_width?: number;
    video_height?: number;
    base_resp: MiniMaxBaseResp;
};

export async function minimaxFetch<T>(path: string, init: RequestInit): Promise<T> {
    if (!MINIMAX_API_KEY) {
        throw new Error('MINIMAX_API_KEY is not configured');
    }

    const res = await fetch(`${MINIMAX_BASE_URL}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${MINIMAX_API_KEY}`,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`MiniMax HTTP ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
}

export async function createFirstLastVideoTask(opts: {
    model: string;
    firstFrameUrl: string;
    lastFrameUrl: string;
    prompt?: string;
    duration?: number;
    resolution?: '768P' | '1080P';
    promptOptimizer?: boolean;
}): Promise<MiniMaxVideoTaskResponse> {
    const body = {
        model: opts.model,
        first_frame_image: opts.firstFrameUrl,
        last_frame_image: opts.lastFrameUrl,
        prompt: opts.prompt,
        duration: opts.duration ?? 6,
        resolution: opts.resolution ?? '768P',
        prompt_optimizer: opts.promptOptimizer ?? true,
    };

    const res = await minimaxFetch<MiniMaxVideoTaskResponse>('/v1/video_generation', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (process.env.NODE_ENV !== 'test') {
        console.log('[minimax-video] createFirstLastVideoTask response', JSON.stringify(res));
    }
    return res;
}

export async function createImageToVideoTask(opts: {
    model: string;
    firstFrameUrl: string;
    prompt?: string;
    duration?: number;
    resolution?: '512P' | '720P' | '768P' | '1080P';
    promptOptimizer?: boolean;
}): Promise<MiniMaxVideoTaskResponse> {
    const body = {
        model: opts.model,
        first_frame_image: opts.firstFrameUrl,
        prompt: opts.prompt,
        duration: opts.duration ?? 6,
        resolution: opts.resolution ?? '768P',
        prompt_optimizer: opts.promptOptimizer ?? true,
    };

    const res = await minimaxFetch<MiniMaxVideoTaskResponse>('/v1/video_generation', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (process.env.NODE_ENV !== 'test') {
        console.log('[minimax-video] createImageToVideoTask response', JSON.stringify(res));
    }
    return res;
}

export async function queryVideoTask(taskId: string): Promise<MiniMaxVideoQueryResponse> {
    const url = `/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`;
    return minimaxFetch(url, { method: 'GET' });
}

