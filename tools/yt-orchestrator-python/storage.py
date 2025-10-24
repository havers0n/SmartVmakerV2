"""
Supabase Storage Helper
Uploads analysis artifacts (JSON, TXT, RAW) to Supabase Storage
and returns public URLs for storing in the database.
"""

import os
import json
from typing import Optional
from supabase import create_client


SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
BUCKET = os.environ.get("STORAGE_BUCKET", "analysis")

_client = None


def supabase():
    """Get or create Supabase client (singleton)."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def upload_text(
    path_key: str, content: str, content_type: str = "application/json"
) -> str:
    """
    Upload text content to Supabase Storage.

    Args:
        path_key: Storage path (e.g., "frames/video_id.json")
        content: Text content to upload
        content_type: MIME type (default: "application/json")

    Returns:
        Public URL of the uploaded file
    """
    sb = supabase()

    # Upload file (upsert=True overwrites if exists)
    sb.storage.from_(BUCKET).upload(
        path_key,
        content.encode("utf-8"),
        {"contentType": content_type, "upsert": True},
    )

    # Get and return public URL
    public_url = sb.storage.from_(BUCKET).get_public_url(path_key)
    return public_url


def upload_json(path_key: str, data: dict) -> str:
    """
    Upload JSON data to Supabase Storage.

    Args:
        path_key: Storage path (e.g., "frames/video_id.json")
        data: Dictionary to serialize as JSON

    Returns:
        Public URL of the uploaded file
    """
    content = json.dumps(data, ensure_ascii=False, indent=2)
    return upload_text(path_key, content, content_type="application/json")


def upload_raw(path_key: str, content: str) -> str:
    """
    Upload raw text to Supabase Storage.

    Args:
        path_key: Storage path (e.g., "frames/video_id.txt")
        content: Raw text content

    Returns:
        Public URL of the uploaded file
    """
    return upload_text(path_key, content, content_type="text/plain")


def get_public_url(path_key: str) -> str:
    """
    Get the public URL for a stored file.

    Args:
        path_key: Storage path

    Returns:
        Public URL
    """
    sb = supabase()
    return sb.storage.from_(BUCKET).get_public_url(path_key)
