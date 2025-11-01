'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/shared/components/ui/pagination';
import { Video as VideoIcon, ExternalLink } from 'lucide-react';
import { callAction } from '@/shared/api/actions';
import { useToast } from '@/shared/hooks/use-toast';

interface Video {
  id: string;
  title: string;
  url: string;
  channelTitle?: string | null;
  durationSeconds?: number | null;
  viewCount?: number | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  thumbnails?: {
    default?: { url: string; width: number; height: number };
    medium?: { url: string; width: number; height: number };
    high?: { url: string; width: number; height: number };
  } | null;
  youtubeId?: string | null;
  // Analysis data
  analysisStatus?: string | null;
  analysisJobId?: string | null;
  analyzer?: string | null;
  analysisId?: string | null;
  analysisUrl?: string | null;
  isAnalyzed?: boolean;
}

interface AnalysisResult {
  success: boolean;
  jobIds: string[];
  count: number;
  analyzer: string;
}

export default function AnalysisPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [analyzer, setAnalyzer] = useState('gemini');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Pagination state
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  // Calculate total pages
  const totalPages = Math.ceil(total / limit);

  // Fetch ingested videos
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const offset = (page - 1) * limit;
        const response = await fetch(`/api/videos?limit=${limit}&offset=${offset}`);

        if (!response.ok) {
          throw new Error('Failed to load videos');
        }

        const data = await response.json();
        setVideos(data.videos || []);
        setTotal(data.total || 0);

        // Clear selection when changing pages to avoid confusion
        setSelectedVideos(new Set());
      } catch (err) {
        console.error('Failed to fetch videos:', err);
        setVideos([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [page]);

  const handleVideoToggle = (videoId: string) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedVideos.size === videos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(videos.map(v => v.id)));
    }
  };

  const handleSubmitAnalysis = async () => {
    if (selectedVideos.size === 0) {
      toast({
        title: 'No videos selected',
        description: 'Please select at least one video to analyze',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const result = await callAction<{
        success: boolean;
        message: string;
        data: {
          totalRequested: number;
          alreadyAnalyzed: number;
          newJobsCreated: number;
        };
      }>('analysis.startAnalysis', {
        videoIds: Array.from(selectedVideos),
      });

      // Show success toast
      toast({
        title: 'Analysis started',
        description: result.message,
        variant: 'default',
      });

      // Clear selection after successful submission
      setSelectedVideos(new Set());

      // Refresh videos list to show updated status
      const response = await fetch('/api/videos');
      if (response.ok) {
        const data = await response.json();
        setVideos(data.videos || []);
      }
    } catch (err) {
      console.error('Failed to start analysis:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);

      // Show error toast
      toast({
        title: 'Analysis failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Utility functions
  function formatSeconds(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  function formatNumber(num: number): string {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(1) + 'B';
    }
    if (num >= 1e6) {
      return (num / 1e6).toFixed(1) + 'M';
    }
    if (num >= 1e3) {
      return (num / 1e3).toFixed(1) + 'K';
    }
    return num.toString();
  }

  function getStatusBadge(video: Video) {
    // If analysis is completed (has analysisUrl or isAnalyzed is true)
    if (video.isAnalyzed || video.analysisUrl) {
      return <Badge variant="default" className="bg-green-500">Analyzed</Badge>;
    }
    // If there's an active job
    if (video.analysisStatus === 'processing') {
      return <Badge variant="secondary">Processing</Badge>;
    }
    if (video.analysisStatus === 'pending') {
      return <Badge variant="outline">Pending</Badge>;
    }
    if (video.analysisStatus === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (video.analysisStatus === 'completed') {
      return <Badge variant="default" className="bg-green-500">Analyzed</Badge>;
    }
    // Not analyzed yet
    return <Badge variant="outline" className="opacity-50">Not Analyzed</Badge>;
  }

  return (
    <div className="container py-6">
      <Card>
        <CardHeader>
          <CardTitle>Analyze Videos</CardTitle>
          <CardDescription>Select ingested videos and run analysis with different analyzers.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Analyzer Selection */}
          <div className="mb-6">
            <Label htmlFor="analyzer">Analyzer</Label>
            <Select value={analyzer} onValueChange={setAnalyzer}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select analyzer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini AI</SelectItem>
                <SelectItem value="nanobanana">Nanobanana</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Videos Loading State */}
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[300px]" />
            </div>
          )}

          {/* Empty State */}
          {!loading && videos.length === 0 && (
            <EmptyState
              icon={VideoIcon}
              title="No videos yet"
              description="Go to the Ingest page to search YouTube for videos."
              action={{
                label: "Go to Ingest",
                onClick: () => window.location.href = '/ingest'
              }}
            />
          )}

          {/* Videos List */}
          {!loading && videos.length > 0 && (
            <div className="mt-4">
              {/* Select All Checkbox */}
              <div className="mb-4">
                <Label className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedVideos.size === videos.length && videos.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span>Select All ({selectedVideos.size}/{videos.length})</span>
                </Label>
              </div>

              {/* Videos Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="w-[120px]">Thumbnail</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Published</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map(video => (
                    <TableRow
                      key={video.id}
                      className={selectedVideos.has(video.id) ? "bg-muted" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedVideos.has(video.id)}
                          onCheckedChange={() => handleVideoToggle(video.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {video.thumbnails?.default?.url ? (
                          <img
                            src={video.thumbnails.default.url}
                            alt={video.title}
                            className="w-full h-auto rounded object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-video bg-muted rounded flex items-center justify-center">
                            <VideoIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {video.title}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>{video.channelTitle}</TableCell>
                      <TableCell>
                        {video.durationSeconds && formatSeconds(video.durationSeconds)}
                      </TableCell>
                      <TableCell>
                        {video.viewCount && formatNumber(video.viewCount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(video)}</TableCell>
                      <TableCell>
                        {video.publishedAt && new Date(video.publishedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (page > 1) {
                              setPage(page - 1);
                            }
                          }}
                          className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>

                      {/* First page */}
                      {page > 2 && (
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(1);
                            }}
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      {/* Ellipsis before current page */}
                      {page > 3 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}

                      {/* Previous page */}
                      {page > 1 && (
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(page - 1);
                            }}
                          >
                            {page - 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      {/* Current page */}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          isActive
                          onClick={(e) => {
                            e.preventDefault();
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>

                      {/* Next page */}
                      {page < totalPages && (
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(page + 1);
                            }}
                          >
                            {page + 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      {/* Ellipsis after current page */}
                      {page < totalPages - 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}

                      {/* Last page */}
                      {page < totalPages - 1 && (
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(totalPages);
                            }}
                          >
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (page < totalPages) {
                              setPage(page + 1);
                            }
                          }}
                          className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>

                  {/* Page info */}
                  <div className="text-center mt-4 text-sm text-muted-foreground">
                    Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} videos
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          {!loading && videos.length > 0 && (
            <div className="mt-6">
              <Button
                onClick={handleSubmitAnalysis}
                disabled={submitting || selectedVideos.size === 0}
              >
                {submitting
                  ? 'Creating jobs...'
                  : `Analyze ${selectedVideos.size} video${selectedVideos.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-md">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Success Message */}
          {result && (
            <div className="mt-4 p-4 bg-success/10 text-success rounded-md">
              <strong>Success!</strong>
              <p>
                Created {result.count} analysis job{result.count !== 1 ? 's' : ''} with {result.analyzer}
              </p>
              <p>Job IDs: {result.jobIds.join(', ')}</p>
              <p>The analysis worker will process these videos in the background.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How to use</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2">
            <li>Videos from ingested searches appear above</li>
            <li>Select one or more videos using checkboxes</li>
            <li>Choose an analyzer (Gemini, etc.)</li>
            <li>Click &quot;Analyze&quot; to create analysis jobs</li>
            <li>The analysis worker will process them and store results</li>
            <li>Results will be available soon with emotional architecture data</li>
          </ol>

          <h3 className="mt-4 font-semibold">About Analyzers</h3>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>Gemini AI:</strong> Advanced emotional architecture analysis using Google Gemini</li>
            <li><strong>Nanobanana:</strong> Lightweight analysis engine</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}