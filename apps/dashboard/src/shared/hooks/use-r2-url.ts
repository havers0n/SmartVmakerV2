import { useQuery } from '@tanstack/react-query';

/**
 * Fetch a presigned download URL for an R2 object key
 *
 * @param key - R2 object key (e.g., "keyframes/project-id/scene-0-first.png")
 * @param expiresIn - URL expiration time in seconds (default: 3600)
 * @returns Presigned download URL
 */
async function fetchDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const response = await fetch('/api/r2/download-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key, expiresIn }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch download URL: ${response.statusText}`);
  }

  const data = await response.json();
  return data.downloadUrl;
}

/**
 * Hook to fetch a presigned download URL for an R2 object
 *
 * This hook automatically fetches a presigned URL when the R2 key is provided.
 * The URL is cached and will be refetched when it expires.
 *
 * @param r2Key - R2 object key (e.g., "keyframes/project-id/scene-0-first.png")
 * @param enabled - Whether to fetch the URL (default: true if r2Key is provided)
 * @returns React Query result with the presigned URL
 *
 * @example
 * const { data: imageUrl, isLoading } = useR2DownloadUrl(asset.storageUrl);
 *
 * return (
 *   <div>
 *     {isLoading && <Spinner />}
 *     {imageUrl && <img src={imageUrl} alt="Image" />}
 *   </div>
 * );
 */
export function useR2DownloadUrl(
  r2Key: string | null | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: ['r2-download-url', r2Key],
    queryFn: () => fetchDownloadUrl(r2Key!),
    enabled: enabled && !!r2Key,
    // Cache for 50 minutes (URLs expire after 1 hour by default)
    staleTime: 50 * 60 * 1000,
    // Keep in cache for 55 minutes
    gcTime: 55 * 60 * 1000,
    // Don't refetch on window focus since URLs are temporary anyway
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch a presigned upload URL for an R2 object key
 *
 * @param key - R2 object key (e.g., "keyframes/project-id/scene-0-first.png")
 * @param contentType - MIME type (e.g., "image/png")
 * @param expiresIn - URL expiration time in seconds (default: 3600)
 * @returns Presigned upload URL
 */
async function fetchUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const response = await fetch('/api/r2/upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key, contentType, expiresIn }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch upload URL: ${response.statusText}`);
  }

  const data = await response.json();
  return data.uploadUrl;
}

/**
 * Hook to fetch a presigned upload URL for an R2 object
 *
 * This hook is typically used with mutation rather than query,
 * since upload URLs are usually generated on-demand.
 *
 * @param r2Key - R2 object key (e.g., "keyframes/project-id/scene-0-first.png")
 * @param contentType - MIME type (e.g., "image/png")
 * @param enabled - Whether to fetch the URL (default: false, use manual trigger)
 * @returns React Query result with the presigned upload URL
 *
 * @example
 * const { data: uploadUrl, refetch } = useR2UploadUrl(
 *   'keyframes/my-project/image.png',
 *   'image/png',
 *   false
 * );
 *
 * // Later, when ready to upload:
 * const { data: url } = await refetch();
 * await fetch(url, { method: 'PUT', body: imageBlob });
 */
export function useR2UploadUrl(
  r2Key: string,
  contentType: string,
  enabled = false
) {
  return useQuery({
    queryKey: ['r2-upload-url', r2Key, contentType],
    queryFn: () => fetchUploadUrl(r2Key, contentType),
    enabled: enabled && !!r2Key && !!contentType,
    // Don't cache upload URLs (they're one-time use)
    staleTime: 0,
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
