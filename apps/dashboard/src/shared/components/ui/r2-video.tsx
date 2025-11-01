"use client";

import { useR2DownloadUrl } from '@/shared/hooks/use-r2-url';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface R2VideoProps {
  /**
   * R2 object key (e.g., "animations/project-id/scene-0.mp4")
   */
  r2Key: string | null | undefined;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Loading component to show while fetching presigned URL
   */
  loadingComponent?: React.ReactNode;

  /**
   * Error component to show if URL fetch fails
   */
  errorComponent?: React.ReactNode;

  /**
   * Whether to autoplay the video
   */
  autoPlay?: boolean;

  /**
   * Whether to loop the video
   */
  loop?: boolean;

  /**
   * Whether to mute the video
   */
  muted?: boolean;

  /**
   * Whether to show video controls
   */
  controls?: boolean;
}

/**
 * Video component that automatically fetches presigned URLs from R2
 *
 * This component handles the complexity of fetching presigned URLs for R2 video objects.
 * It shows a loading state while fetching the URL and handles errors gracefully.
 *
 * @example
 * <R2Video
 *   r2Key={asset.storageUrl}
 *   className="w-full h-full"
 *   controls
 *   muted
 * />
 */
export function R2Video({
  r2Key,
  className,
  loadingComponent,
  errorComponent,
  autoPlay = false,
  loop = false,
  muted = true,
  controls = true,
}: R2VideoProps) {
  const { data: videoUrl, isLoading, error } = useR2DownloadUrl(r2Key);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center bg-muted rounded-lg', className)}>
        {loadingComponent || (
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  if (error || !videoUrl) {
    return (
      <div className={cn('flex items-center justify-center bg-muted rounded-lg', className)}>
        {errorComponent || (
          <span className="text-xs text-destructive">Failed to load video</span>
        )}
      </div>
    );
  }

  return (
    <video
      src={videoUrl}
      className={cn('rounded-lg', className)}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      controls={controls}
      playsInline
    />
  );
}
