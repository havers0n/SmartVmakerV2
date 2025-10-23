import { eq, desc, and } from 'drizzle-orm';
import type { DB } from '../client';
import {
  youtubeVideos,
  videoAnalysis,
  type YouTubeVideo,
  type NewYouTubeVideo,
  type VideoAnalysis,
  type NewVideoAnalysis,
} from '../schema/youtube';
import {
  ingestQueue,
  analysisQueue,
  type IngestQueue,
  type NewIngestQueue,
  type AnalysisQueue,
  type NewAnalysisQueue,
} from '../schema/jobs';

// ============================================================================
// YouTube Videos CRUD
// ============================================================================

export async function upsertYouTubeVideo(
  db: DB,
  video: NewYouTubeVideo,
): Promise<YouTubeVideo> {
  const result = await db
    .insert(youtubeVideos)
    .values(video)
    .onConflictDoUpdate({
      target: youtubeVideos.id,
      set: {
        title: video.title,
        description: video.description,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result[0];
}

export async function getYouTubeVideo(db: DB, id: string): Promise<YouTubeVideo | null> {
  const result = await db
    .select()
    .from(youtubeVideos)
    .where(eq(youtubeVideos.id, id));
  return result[0] || null;
}

export async function getRecentYouTubeVideos(
  db: DB,
  limit = 50,
): Promise<YouTubeVideo[]> {
  return db
    .select()
    .from(youtubeVideos)
    .orderBy(desc(youtubeVideos.createdAt))
    .limit(limit);
}

// ============================================================================
// Video Analysis CRUD
// ============================================================================

export async function createVideoAnalysis(
  db: DB,
  analysis: NewVideoAnalysis,
): Promise<VideoAnalysis> {
  const result = await db.insert(videoAnalysis).values(analysis).returning();
  return result[0];
}

export async function getVideoAnalysisByVideoId(
  db: DB,
  videoId: string,
  analyzer?: string,
): Promise<VideoAnalysis | null> {
  const conditions = [eq(videoAnalysis.videoId, videoId)];
  if (analyzer) {
    conditions.push(eq(videoAnalysis.analyzer, analyzer));
  }

  const result = await db
    .select()
    .from(videoAnalysis)
    .where(and(...conditions));

  return result[0] || null;
}

export async function updateVideoAnalysisUrl(
  db: DB,
  id: string,
  analysisUrl: string,
): Promise<VideoAnalysis> {
  const result = await db
    .update(videoAnalysis)
    .set({ analysisUrl, updatedAt: new Date() })
    .where(eq(videoAnalysis.id, id))
    .returning();

  return result[0];
}

// ============================================================================
// Ingest Queue CRUD (for jobs.ts in orchestrator to use)
// ============================================================================

export async function createIngestJob(
  db: DB,
  job: NewIngestQueue,
): Promise<IngestQueue> {
  const result = await db.insert(ingestQueue).values(job).returning();
  return result[0];
}

export async function getNextPendingIngestJob(db: DB): Promise<IngestQueue | null> {
  const result = await db
    .select()
    .from(ingestQueue)
    .where(eq(ingestQueue.status, 'pending'))
    .orderBy(ingestQueue.createdAt)
    .limit(1);

  return result[0] || null;
}

export async function updateIngestJobStatus(
  db: DB,
  id: string,
  status: string,
  error?: string,
): Promise<IngestQueue> {
  const updates: any = { status, updatedAt: new Date() };
  if (error) updates.error = error;

  const result = await db
    .update(ingestQueue)
    .set(updates)
    .where(eq(ingestQueue.id, id))
    .returning();

  return result[0];
}

// ============================================================================
// Analysis Queue CRUD (for jobs.ts in orchestrator to use)
// ============================================================================

export async function createAnalysisJob(
  db: DB,
  job: NewAnalysisQueue,
): Promise<AnalysisQueue> {
  const result = await db.insert(analysisQueue).values(job).returning();
  return result[0];
}

export async function getNextPendingAnalysisJob(db: DB): Promise<AnalysisQueue | null> {
  const result = await db
    .select()
    .from(analysisQueue)
    .where(eq(analysisQueue.status, 'pending'))
    .orderBy(analysisQueue.createdAt)
    .limit(1);

  return result[0] || null;
}

export async function updateAnalysisJobStatus(
  db: DB,
  id: string,
  status: string,
  error?: string,
): Promise<AnalysisQueue> {
  const updates: any = { status, updatedAt: new Date() };
  if (error) updates.error = error;

  const result = await db
    .update(analysisQueue)
    .set(updates)
    .where(eq(analysisQueue.id, id))
    .returning();

  return result[0];
}
