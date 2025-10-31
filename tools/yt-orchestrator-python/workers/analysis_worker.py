#!/usr/bin/env python3
"""
Video Analysis Worker

Processes analysis_queue jobs to analyze videos using different analyzers.
Runs as a long-lived worker process that polls the database for pending jobs.

Usage:
    python analysis_worker.py
"""

import os
import sys
import time
import json
import logging
from typing import Optional, Tuple, Dict, Any
from datetime import datetime
from pathlib import Path
import tempfile

# Load environment variables from root .env file
try:
    # Add the project root to the path so we can import the dotenv module
    project_root = Path(__file__).parent.parent.parent.parent
    env_path = project_root / '.env'
    if env_path.exists():
        # Import dotenv locally to avoid linter issues
        import importlib
        dotenv = importlib.import_module('dotenv')
        dotenv.load_dotenv(dotenv_path=env_path)
        logging.info(f'Loaded environment variables from {env_path}')
except ImportError:
    logging.warning('python-dotenv not available, skipping .env file loading')
except Exception as e:
    logging.warning(f'Error loading .env file: {e}')

import psycopg2
 
# Import storage helper (add parent directory to path)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from storage import upload_json, upload_raw, get_public_url
from psycopg2.extras import RealDictCursor

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class VideoAnalyzer:
    """Handles video analysis using different backends."""

    def __init__(self, analyzer: str):
        """
        Initialize analyzer.

        Args:
            analyzer: Analyzer name ('gemini', 'nanobanana', etc.)
        """
        self.analyzer = analyzer

    def analyze(self, video_id: str, video_url: str) -> Dict[str, Any]:
        """
        Analyze a video.

        Args:
            video_id: YouTube video ID
            video_url: YouTube video URL

        Returns:
            Analysis result dictionary with emotional architecture data
        """
        logger.info(f'Analyzing {video_id} with {self.analyzer}')

        try:
            if self.analyzer == 'gemini':
                return self._analyze_with_gemini(video_id, video_url)
            elif self.analyzer == 'nanobanana':
                return self._analyze_with_nanobanana(video_id, video_url)
            else:
                raise ValueError(f'Unknown analyzer: {self.analyzer}')

        except Exception as e:
            logger.error(f'Analysis failed: {e}')
            raise

    def _analyze_with_gemini(self, video_id: str, video_url: str) -> Dict[str, Any]:
        """
        Analyze video using Gemini API.

        Args:
            video_id: YouTube video ID
            video_url: YouTube video URL

        Returns:
            Analysis result
        """
        # TODO: Integrate with Gemini API
        # For now, return stub analysis
        logger.info(f'Gemini analysis for {video_id}')

        return {
            'video_id': video_id,
            'analyzer': 'gemini',
            'emotional_architecture': {
                'primary_emotion': 'informative',
                'secondary_emotions': ['engaging', 'professional'],
                'tone': 'educational',
                'pacing': 'moderate',
            },
            'key_frames': [
                {'timestamp': 0, 'emotion': 'intro', 'description': 'Introduction'},
                {'timestamp': 30, 'emotion': 'main', 'description': 'Main content'},
            ],
            'summary': 'Video analysis would go here',
            'timestamp': datetime.now().isoformat(),
        }

    def _analyze_with_nanobanana(
        self, video_id: str, video_url: str
    ) -> Dict[str, Any]:
        """
        Analyze video using Nanobanana (stub).

        Args:
            video_id: YouTube video ID
            video_url: YouTube video URL

        Returns:
            Analysis result
        """
        # TODO: Integrate with Nanobanana API
        logger.info(f'Nanobanana analysis for {video_id}')

        return {
            'video_id': video_id,
            'analyzer': 'nanobanana',
            'features': {},
            'timestamp': datetime.now().isoformat(),
        }


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

    def get_pending_job(self) -> Optional[Tuple[str, str, str]]:
        """
        Get next pending analysis job from queue.

        Returns:
            Tuple of (job_id, video_id, analyzer) or None
        """
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, video_id, analyzer
                    FROM analysis_queue
                    WHERE status = 'pending'
                    ORDER BY created_at ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                    """
                )
                result = cur.fetchone()
                conn.close()

                if result:
                    return (result['id'], result['video_id'], result['analyzer'])

                return None

        except psycopg2.Error as e:
            logger.error(f'Database error getting pending job: {e}')
            return None

    def update_job_status(
        self,
        job_id: str,
        status: str,
        error: Optional[str] = None,
    ) -> bool:
        """
        Update analysis job status.

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
                        UPDATE analysis_queue
                        SET status = %s, error = %s, updated_at = NOW()
                        WHERE id = %s
                        """,
                        (status, error, job_id),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE analysis_queue
                        SET status = %s, updated_at = NOW()
                        WHERE id = %s
                        """,
                        (status, job_id),
                    )

            conn.commit()
            conn.close()
            return True

        except psycopg2.Error as e:
            logger.error(f'Database error updating job status: {e}')
            return False

    def get_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        """
        Get video metadata from youtube_videos table.

        Args:
            video_id: YouTube video ID

        Returns:
            Video metadata dictionary or None
        """
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    'SELECT * FROM youtube_videos WHERE id = %s',
                    (video_id,),
                )
                result = cur.fetchone()
                conn.close()
                return result

        except psycopg2.Error as e:
            logger.error(f'Database error getting video: {e}')
            return None

    def save_analysis(
        self,
        video_id: str,
        analyzer: str,
        analysis_url: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> bool:
        """
        Save analysis result to video_analysis table.

        Args:
            video_id: YouTube video ID
            analyzer: Analyzer name
            analysis_url: URL to stored analysis JSON
            metadata: Additional metadata

        Returns:
            True if successful
        """
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO video_analysis (video_id, analyzer, analysis_url, metadata)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (video_id, analyzer) DO UPDATE SET
                        analysis_url = EXCLUDED.analysis_url,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                    """,
                    (
                        video_id,
                        analyzer,
                        analysis_url,
                        json.dumps(metadata) if metadata else None,
                    ),
                )

            conn.commit()
            conn.close()
            return True

        except psycopg2.Error as e:
            logger.error(f'Database error saving analysis: {e}')
            return False


class StorageManager:
    """Handles artifact storage (Supabase)."""

    def __init__(self):
        """Initialize storage manager with Supabase client."""
        logger.info('Using Supabase Storage for artifacts')

    def save_analysis(self, video_id: str, analyzer: str, data: Dict) -> str:
        """
        Save analysis data to Supabase Storage.

        Args:
            video_id: YouTube video ID
            analyzer: Analyzer name
            data: Analysis data to store

        Returns:
            Public URL to stored file
        """
        try:
            # Generate storage path
            path_key = f'analysis/{video_id}_{analyzer}.json'

            # Upload to Supabase Storage
            public_url = upload_json(path_key, data)
            logger.info(f'Saved analysis to Supabase: {public_url}')
            return public_url

        except Exception as e:
            logger.error(f'Error saving analysis to Supabase: {e}')
            raise

    def upload_to_supabase(self, data: Dict, video_id: str, analyzer: str) -> Optional[str]:
        """
        Upload analysis data to Supabase Storage.

        Args:
            data: Analysis data dictionary
            video_id: YouTube video ID
            analyzer: Analyzer name

        Returns:
            Public URL or None
        """
        try:
            path_key = f'analysis/{video_id}_{analyzer}.json'
            public_url = upload_json(path_key, data)
            logger.info(f'Uploaded analysis to Supabase: {public_url}')
            return public_url
        except Exception as e:
            logger.error(f'Failed to upload to Supabase: {e}')
            return None


def run_worker(poll_interval: int = 5) -> None:
    """
    Main worker loop.

    Args:
        poll_interval: Seconds to wait between job polls
    """
    # Get configuration from environment
    database_url = os.getenv('DATABASE_URL')

    if not database_url:
        logger.error('DATABASE_URL environment variable is not set')
        sys.exit(1)

    # Initialize components
    queue = JobQueue(database_url)
    storage = StorageManager()

    logger.info('Video Analysis Worker starting...')
    logger.info(f'Polling interval: {poll_interval} seconds')

    try:
        while True:
            job = queue.get_pending_job()

            if not job:
                logger.debug(f'No pending jobs, sleeping {poll_interval}s')
                time.sleep(poll_interval)
                continue

            job_id, video_id, analyzer = job
            logger.info(f'Processing job {job_id}: {video_id} with {analyzer}')

            # Mark as processing
            queue.update_job_status(job_id, 'processing')

            try:
                # Get video metadata
                video = queue.get_video(video_id)

                if not video:
                    raise ValueError(f'Video not found: {video_id}')

                # Run analysis
                analyzer_obj = VideoAnalyzer(analyzer)
                analysis = analyzer_obj.analyze(video_id, video['url'])

                # Upload to Supabase and get public URL
                analysis_url = storage.save_analysis(video_id, analyzer, analysis)

                if not analysis_url:
                    raise ValueError('Failed to upload analysis to Supabase Storage')

                # Save metadata to database with Supabase URL
                queue.save_analysis(
                    video_id,
                    analyzer,
                    analysis_url=analysis_url,
                    metadata={'analyzer': analyzer, 'beats_count': len(analysis.get('key_frames', []))},
                )

                logger.info(f'Job {job_id}: Analysis complete, saved to {analysis_url}')

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
