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
import { Video as VideoIcon, ExternalLink } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  url: string;
  channelTitle?: string | null;
  durationSeconds?: number | null;
  viewCount?: number | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  // Analysis data
  analysisStatus?: string | null;
  analysisJobId?: string | null;
  analyzer?: string | null;
  analysisId?: string | null;
  analysisUrl?: string | null;
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

  // Fetch ingested videos
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call to /api/videos or similar
        // For now, fetch from youtube_videos table via backend
        const response = await fetch('/api/videos');

        if (!response.ok) {
          throw new Error('Failed to load videos');
        }

        const data = await response.json();
        setVideos(data.videos || []);
      } catch (err) {
        // For now, show placeholder if API doesn't exist yet
        console.log('Videos API not yet implemented. Showing placeholder.');
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

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
      setError('Please select at least one video');
      return;
    }

    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/analysis/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoIds: Array.from(selectedVideos),
          analyzer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create analysis job');
      }

      setResult(data);
      setSelectedVideos(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
    if (video.analysisUrl) {
      return <Badge variant="default" className="bg-green-500">Completed</Badge>;
    }
    if (video.analysisStatus === 'processing') {
      return <Badge variant="secondary">Processing</Badge>;
    }
    if (video.analysisStatus === 'pending') {
      return <Badge variant="outline">Pending</Badge>;
    }
    if (video.analysisStatus === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="outline" className="opacity-50">Not Queued</Badge>;
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
                    <TableHead>Title</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Analyzer</TableHead>
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
                        {video.analyzer && <span className="text-sm text-muted-foreground">{video.analyzer}</span>}
                      </TableCell>
                      <TableCell>
                        {video.publishedAt && new Date(video.publishedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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