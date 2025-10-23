#!/usr/bin/env python3
"""
YouTube Ingestion Worker

Processes ingest_queue jobs to search YouTube and store video metadata.
Runs as a long-lived worker process that polls the database for pending jobs.

Usage:
    python ingest_worker.py
"""

import os
import sys
import time
import json
import logging
from typing import Optional, List, Tuple
from datetime import datetime
import re

import psycopg2
from psycopg2.extras import RealDictCursor
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class YouTubeIngestor:
    """Handles YouTube API calls and video metadata fetching."""

    def __init__(self, api_key: str, max_results: int = 50):
        """
        Initialize YouTube API client.

        Args:
            api_key: YouTube Data API v3 key
            max_results: Max videos to fetch per search (1-50)
        """
        self.api_key = api_key
        self.max_results = min(max_results, 50)
        self.youtube = build('youtube', 'v3', developerKey=api_key)

    def search_video_ids(
        self,
        query: str,
        published_after: Optional[str] = None,
        duration: str = 'short',
        limit: int = 50,
    ) -> List[str]:
        """
        Search YouTube for videos matching the query.

        Args:
            query: Search query string
            published_after: ISO 8601 date string (e.g., '2024-01-01T00:00:00Z')
            duration: 'short', 'medium', or 'long'
            limit: Max results to return

        Returns:
            List of YouTube video IDs
        """
        try:
            logger.info(f"Searching YouTube for: {query}")

            request = self.youtube.search().list(
                part='id',
                q=query,
                type='video',
                maxResults=min(limit, self.max_results),
                publishedAfter=published_after,
                videoDuration=duration,
                order='date',
                safeSearch='none',
            )

            response = request.execute()
            ids = []

            for item in response.get('items', []):
                if item['id']['kind'] == 'youtube#video':
                    ids.append(item['id']['videoId'])

            logger.info(f"Found {len(ids)} videos")
            return ids

        except HttpError as e:
            logger.error(f"YouTube API error: {e}")
            raise

    def fetch_video_metadata(self, video_ids: List[str]) -> List[dict]:
        """
        Fetch detailed metadata for videos.

        Args:
            video_ids: List of YouTube video IDs

        Returns:
            List of video metadata dictionaries
        """
        metadata = []

        # Process in batches of 50 (YouTube API limit)
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i : i + 50]

            try:
                logger.info(f"Fetching metadata for batch {i // 50 + 1}")

                request = self.youtube.videos().list(
                    part='snippet,contentDetails,statistics',
                    id=','.join(batch),
                )

                response = request.execute()

                for video in response.get('items', []):
                    snippet = video.get('snippet', {})
                    stats = video.get('statistics', {})
                    content = video.get('contentDetails', {})

                    duration_seconds = self._parse_iso_duration(
                        content.get('duration', '')
                    )

                    metadata.append(
                        {
                            'id': video['id'],
                            'url': f"https://www.youtube.com/watch?v={video['id']}",
                            'title': snippet.get('title', ''),
                            'description': snippet.get('description', ''),
                            'published_at': snippet.get('publishedAt'),
                            'channel_title': snippet.get('channelTitle', ''),
                            'duration_seconds': duration_seconds,
                            'view_count': int(stats.get('viewCount', 0)),
                            'like_count': int(stats.get('likeCount', 0)),
                            'comment_count': int(stats.get('commentCount', 0)),
                            'tags': snippet.get('tags', []),
                        }
                    )

                # Rate limiting - YouTube API has quotas
                if i + 50 < len(video_ids):
                    time.sleep(1.0)

            except HttpError as e:
                logger.error(f"Error fetching batch metadata: {e}")
                continue

        return metadata

    @staticmethod
    def _parse_iso_duration(iso_duration: str) -> Optional[int]:
        """
        Parse ISO 8601 duration string to seconds.

        Example: 'PT1H23M45S' -> 5025

        Args:
            iso_duration: ISO 8601 duration string

        Returns:
            Total seconds or None if invalid
        """
        if not iso_duration:
            return None

        # Pattern: PT[hours]H[minutes]M[seconds]S
        pattern = r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?'
        match = re.match(pattern, iso_duration)

        if not match:
            return None

        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)

        return hours * 3600 + minutes * 60 + seconds


class JobQueue:
    """Handles database operations for job queues."""

    def __init__(self, connection_string: str):
        """
        Initialize database connection.

        Args:
            connection_string: PostgreSQL connection string
        """
        self.connection_string = connection_string

    def get_connection(self):
        """Create a new database connection."""
        return psycopg2.connect(self.connection_string)

    def get_pending_job(self) -> Optional[Tuple[str, str, Optional[str], str]]:
        """
        Get next pending ingest job from queue.

        Returns:
            Tuple of (job_id, query, published_after, duration) or None
        """
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, query, published_after, duration
                    FROM ingest_queue
                    WHERE status = 'pending'
                    ORDER BY created_at ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                    """
                )
                result = cur.fetchone()
                conn.close()

                if result:
                    return (
                        result['id'],
                        result['query'],
                        result['published_after'],
                        result['duration'],
                    )

                return None

        except psycopg2.Error as e:
            logger.error(f"Database error getting pending job: {e}")
            return None

    def update_job_status(
        self,
        job_id: str,
        status: str,
        error: Optional[str] = None,
    ) -> bool:
        """
        Update ingest job status.

        Args:
            job_id: Job ID
            status: New status ('processing', 'done', 'failed')
            error: Error message if failed

        Returns:
            True if successful
        """
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                if error:
                    cur.execute(
                        """
                        UPDATE ingest_queue
                        SET status = %s, error = %s, updated_at = NOW()
                        WHERE id = %s
                        """,
                        (status, error, job_id),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE ingest_queue
                        SET status = %s, updated_at = NOW()
                        WHERE id = %s
                        """,
                        (status, job_id),
                    )

            conn.commit()
            conn.close()
            return True

        except psycopg2.Error as e:
            logger.error(f"Database error updating job status: {e}")
            return False

    def upsert_videos(self, videos: List[dict]) -> int:
        """
        Insert or update videos in youtube_videos table.

        Args:
            videos: List of video metadata dictionaries

        Returns:
            Number of videos upserted
        """
        if not videos:
            return 0

        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                for video in videos:
                    cur.execute(
                        """
                        INSERT INTO youtube_videos (
                            id, url, title, description, published_at,
                            channel_title, duration_seconds, view_count,
                            like_count, comment_count, tags
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            view_count = EXCLUDED.view_count,
                            like_count = EXCLUDED.like_count,
                            comment_count = EXCLUDED.comment_count,
                            updated_at = NOW()
                        """,
                        (
                            video['id'],
                            video['url'],
                            video['title'],
                            video['description'],
                            video['published_at'],
                            video['channel_title'],
                            video['duration_seconds'],
                            video['view_count'],
                            video['like_count'],
                            video['comment_count'],
                            json.dumps(video['tags']),
                        ),
                    )

            conn.commit()
            conn.close()
            logger.info(f"Upserted {len(videos)} videos")
            return len(videos)

        except psycopg2.Error as e:
            logger.error(f"Database error upserting videos: {e}")
            return 0


def run_worker(poll_interval: int = 5) -> None:
    """
    Main worker loop.

    Args:
        poll_interval: Seconds to wait between job polls
    """
    # Get configuration from environment
    database_url = os.getenv('DATABASE_URL')
    youtube_api_key = os.getenv('YOUTUBE_API_KEY')

    if not database_url:
        logger.error('DATABASE_URL environment variable is not set')
        sys.exit(1)

    if not youtube_api_key:
        logger.error('YOUTUBE_API_KEY environment variable is not set')
        sys.exit(1)

    # Initialize components
    ingestor = YouTubeIngestor(youtube_api_key)
    queue = JobQueue(database_url)

    logger.info('YouTube Ingest Worker starting...')
    logger.info(f'Polling interval: {poll_interval} seconds')

    try:
        while True:
            job = queue.get_pending_job()

            if not job:
                logger.debug(f'No pending jobs, sleeping {poll_interval}s')
                time.sleep(poll_interval)
                continue

            job_id, query, published_after, duration = job
            logger.info(f'Processing job {job_id}: {query}')

            # Mark as processing
            queue.update_job_status(job_id, 'processing')

            try:
                # Search for videos
                video_ids = ingestor.search_video_ids(
                    query,
                    published_after=published_after,
                    duration=duration,
                    limit=50,
                )

                if not video_ids:
                    logger.warning(f'Job {job_id}: No videos found')
                    queue.update_job_status(job_id, 'done')
                    continue

                # Fetch metadata
                videos = ingestor.fetch_video_metadata(video_ids)

                # Store in database
                count = queue.upsert_videos(videos)
                logger.info(f'Job {job_id}: Stored {count} videos')

                # Mark as done
                queue.update_job_status(job_id, 'done')

            except Exception as e:
                error_msg = f'{type(e).__name__}: {str(e)}'
                logger.error(f'Job {job_id} failed: {error_msg}')
                queue.update_job_status(job_id, 'failed', error_msg)

    except KeyboardInterrupt:
        logger.info('Worker interrupted, shutting down...')
        sys.exit(0)
    except Exception as e:
        logger.error(f'Unexpected error: {e}', exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    run_worker()
