import { eq } from 'drizzle-orm';
import { minimaxFetch, queryVideoTask } from '@scrimspec/hwar-core/providers/minimax-video';
import { db } from '@/shared/lib/db';
import { generationAnimationJobs } from '@/shared/lib/schema';

const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;

async function resolveMiniMaxFileUrl(fileId: string): Promise<string | null> {
  const json = await minimaxFetch<any>(`/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`, {
    method: 'GET',
  });

  if (json.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax file retrieve error: ${json.base_resp?.status_code} ${json.base_resp?.status_msg ?? 'unknown'}`);
  }

  return json.file?.download_url || json.file?.url || null;
}

export async function syncMiniMaxVideoJob(jobId: string) {
  const job = await db.query.generationAnimationJobs.findFirst({
    where: eq(generationAnimationJobs.id, jobId),
  });

  if (!job || !job.minimaxTaskId) return;

  const res = await queryVideoTask(job.minimaxTaskId);

  if (res.base_resp.status_code !== 0) {
    await db
      .update(generationAnimationJobs)
      .set({
        status: 'failed',
        errorCode: String(res.base_resp.status_code),
        errorMessage: res.base_resp.status_msg,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationAnimationJobs.id, job.id));
    return;
  }

  if (res.status === 'Preparing' || res.status === 'Queueing' || res.status === 'Processing') {
    await db
      .update(generationAnimationJobs)
      .set({
        status: 'running',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationAnimationJobs.id, job.id));
    return;
  }

  if (res.status === 'Fail') {
    await db
      .update(generationAnimationJobs)
      .set({
        status: 'failed',
        errorCode: res.base_resp?.status_code ? String(res.base_resp.status_code) : 'fail',
        errorMessage: res.base_resp?.status_msg ?? 'MiniMax reported failure',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationAnimationJobs.id, job.id));
    return;
  }

  if (res.status === 'Success') {
    const videoUrl = await resolveMiniMaxFileUrl(res.file_id!);

    await db
      .update(generationAnimationJobs)
      .set({
        status: 'succeeded',
        minimaxFileId: res.file_id!,
        videoUrl,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationAnimationJobs.id, job.id));
  }
}

