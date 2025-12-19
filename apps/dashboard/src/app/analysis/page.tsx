'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/shared/components/ui/pagination';
import { Video as VideoIcon, Sparkles, BrainCircuit } from 'lucide-react'; // Added icons
import { callAction } from '@/shared/api/actions';
import { useToast } from '@/shared/hooks/use-toast';
import { useRouter } from 'next/navigation';

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
  const [selectedAnalyzer, setSelectedAnalyzer] = useState('gemini');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const router = useRouter();

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
        analyzer: selectedAnalyzer,
      });

      // Show success toast
      toast({
        title: 'Analysis started',
        description: `${result.message} Analyzer: ${selectedAnalyzer}`,
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

  // --- CHANGED JSX STARTS HERE ---
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Analysis Lab
            <BrainCircuit className="h-6 w-6 text-primary" />
          </h1>
          <p className="text-muted-foreground mt-1">
            Extract emotional architecture and viral patterns from ingested content.
          </p>
        </div>
        
        {/* Actions Bar */}
        <div className="flex items-center gap-4 bg-card/50 p-2 rounded-lg border border-border/50 backdrop-blur-sm">
           <Select value={selectedAnalyzer} onValueChange={setSelectedAnalyzer} disabled={submitting}>
              <SelectTrigger className="w-[180px] border-none bg-transparent focus:ring-0" disabled={submitting}>
                <SelectValue placeholder="Select analyzer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">
                    <span className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-blue-400"/> Gemini 1.5 Pro</span>
                </SelectItem>
                <SelectItem value="nanobanana">Nanobanana (Fast)</SelectItem>
              </SelectContent>
            </Select>
            <div className="h-4 w-px bg-border mx-2" />
            <Button 
                onClick={handleSubmitAnalysis} 
                disabled={submitting || selectedVideos.size === 0}
                className={selectedVideos.size > 0 ? "animate-in zoom-in duration-200" : ""}
            >
                {submitting ? 'Dispatching...' : `Analyze ${selectedVideos.size || ''} Selection`}
            </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-0">
          {loading && (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {!loading && videos.length === 0 && (
            <div className="py-16">
                <EmptyState
                icon={VideoIcon}
                title="Lab is Empty"
                description="Ingest videos first to populate the analysis queue."
                action={{
                    label: "Go to Ingest",
                    onClick: () => window.location.href = '/ingest'
                }}
                />
            </div>
          )}

          {!loading && videos.length > 0 && (
            <>
              <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                 <Label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={selectedVideos.size === videos.length && videos.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Select All ({videos.length})</span>
                </Label>
              </div>

              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="w-[140px]">Preview</TableHead>
                    <TableHead>Metadata</TableHead>
                    <TableHead>Metrics</TableHead>
                    <TableHead>Analysis Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map(video => (
                    <TableRow
                      key={video.id}
                      className={`
                        cursor-pointer transition-colors border-border/50
                        ${selectedVideos.has(video.id) ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30"}
                      `}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('[role="checkbox"]') || (e.target as HTMLElement).closest('a')) return;
                        if (video.isAnalyzed || video.analysisUrl) router.push(`/analysis/${video.id}`);
                        else handleVideoToggle(video.id);
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedVideos.has(video.id)}
                          onCheckedChange={() => handleVideoToggle(video.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="relative aspect-video rounded-md overflow-hidden border border-white/10 shadow-sm">
                           {video.thumbnails?.default?.url ? (
                            <img src={video.thumbnails.default.url} alt="" className="object-cover w-full h-full" />
                           ) : <div className="w-full h-full bg-secondary flex items-center justify-center"><VideoIcon className="h-4 w-4 opacity-20"/></div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                            <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                            onClick={(e) => e.stopPropagation()}
                            >
                            {video.title}
                            </a>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium text-secondary-foreground">{video.channelTitle}</span>
                                <span>•</span>
                                <span>{video.publishedAt && new Date(video.publishedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                           <div className="flex justify-between w-24">
                                <span className="text-muted-foreground">Views</span>
                                <span className="font-mono">{video.viewCount && formatNumber(video.viewCount)}</span>
                           </div>
                           <div className="flex justify-between w-24">
                                <span className="text-muted-foreground">Duration</span>
                                <span className="font-mono">{video.durationSeconds && formatSeconds(video.durationSeconds)}</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(video)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Pagination Block (Styling Update Only) */}
      {!loading && totalPages > 1 && (
         <div className="flex justify-center pt-4">
             <Pagination>
                <PaginationContent>
                    <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }} /></PaginationItem>
                     {/* ... (Keep existing pagination logic here, just ensure imports match) ... */}
                    <PaginationItem><span className="flex h-9 min-w-9 items-center justify-center text-xs text-muted-foreground">Page {page} of {totalPages}</span></PaginationItem>
                    <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }} /></PaginationItem>
                </PaginationContent>
             </Pagination>
         </div>
      )}

      {/* Messages */}
      {error && <div className="p-4 border border-destructive/20 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>}
      {result && (
        <div className="p-4 border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm flex flex-col gap-1">
           <span className="font-semibold flex items-center gap-2">Success <Sparkles className="h-3 w-3"/></span>
           <span>Dispatched {result.count} jobs to the {result.analyzer} queue.</span>
        </div>
      )}
    </div>
  );
}