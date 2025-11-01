"use client";

import { useR2DownloadUrl } from '@/shared/hooks/use-r2-url';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface R2ImageProps {
  /**
   * R2 object key (e.g., "keyframes/project-id/scene-0-first.png")
   */
  r2Key: string | null | undefined;

  /**
   * Alt text for the image
   */
  alt: string;

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
}

/**
 * Image component that automatically fetches presigned URLs from R2
 *
 * This component handles the complexity of fetching presigned URLs for R2 objects.
 * It shows a loading state while fetching the URL and handles errors gracefully.
 *
 * @example
 * <R2Image
 *   r2Key={asset.storageUrl}
 *   alt="Scene 1 - Opening Frame"
 *   className="w-full h-full object-cover"
 * />
 */
export function R2Image({
  r2Key,
  alt,
  className,
  loadingComponent,
  errorComponent,
}: R2ImageProps) {
  const { data: imageUrl, isLoading, error } = useR2DownloadUrl(r2Key);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        {loadingComponent || (
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        {errorComponent || (
          <span className="text-xs text-destructive">Failed to load image</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
}
