'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/shared/components/ui/pagination';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Video, Search, TrendingUp, Eye, Calendar, Clock } from 'lucide-react';

interface BeamngVideo {
  id: string;
  youtubeId: string | null;
  title: string;
  url: string;
  channelTitle: string | null;
  channelId: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  publishedAt: string | null;
  thumbnails: Record<string, { url: string }> | null;
  channel: { youtubeChannelId: string; handle: string | null; subscriberCount: number | null } | null;
  metrics: {
    viewsPerDay: number | null;
    likesPer1000Views: number | null;
    commentsPer1000Views: number | null;
    engagementRate: number | null;
    videoAgeDays: number | null;
  };
}

function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getThumbnailUrl(thumbnails: Record<string, { url: string }> | null): string | null {
  if (!thumbnails) return null;
  return thumbnails.medium?.url || thumbnails.default?.url || thumbnails.high?.url || null;
}

export default function BeamngVideosPage() {
  const [videos, setVideos] = useState<BeamngVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('publishedAt');
  const [sortDir, setSortDir] = useState('desc');
  const limit = 50;
  const totalPages = Math.ceil(total / limit);

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset), sortBy, sortDir });
      if (search) params.set('search', search);
      const res = await fetch(`/api/beamng/videos?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setVideos(data.videos || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortDir]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            BeamNG Videos
          </h1>
          <p className="text-muted-foreground mt-1">
            All ingested videos with computed engagement metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="publishedAt">Published</SelectItem>
              <SelectItem value="views">Views</SelectItem>
              <SelectItem value="durationSeconds">Duration</SelectItem>
              <SelectItem value="title">Title</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} className="h-9">
            {sortDir === 'desc' ? '↓' : '↑'}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-0">
          {loading && (
            <div className="p-8 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          )}

          {!loading && videos.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No videos yet</p>
              <p className="text-sm">Import channels or ingest videos to see data here.</p>
            </div>
          )}

          {!loading && videos.length > 0 && (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="w-[140px]">Preview</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1"><Eye className="h-3 w-3" /> Views</div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1"><Calendar className="h-3 w-3" /> Published</div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1"><Clock className="h-3 w-3" /> Duration</div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1"><TrendingUp className="h-3 w-3" /> Views/Day</div>
                  </TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                  <TableHead className="text-right">Comments/1K</TableHead>
                  <TableHead className="text-right">Likes/1K</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((v) => (
                  <TableRow key={v.id} className="border-border/50 hover:bg-muted/30">
                    <TableCell>
                      <a href={v.url} target="_blank" rel="noopener noreferrer">
                        <div className="relative aspect-video w-[130px] rounded-md overflow-hidden border border-white/10 shadow-sm">
                          {getThumbnailUrl(v.thumbnails) ? (
                            <img src={getThumbnailUrl(v.thumbnails)!} alt="" className="object-cover w-full h-full" />
                          ) : (
                            <div className="w-full h-full bg-secondary flex items-center justify-center">
                              <Video className="h-4 w-4 opacity-20" />
                            </div>
                          )}
                        </div>
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 max-w-[280px]">
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground hover:text-primary transition-colors line-clamp-2 text-sm leading-tight"
                        >
                          {v.title}
                        </a>
                        <span className="text-xs text-muted-foreground">{v.channelTitle || v.channel?.handle || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {v.viewCount != null ? formatNumber(v.viewCount) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(v.publishedAt)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatDuration(v.durationSeconds)}
                    </TableCell>
                    <TableCell className="text-right">
                      {v.metrics.viewsPerDay != null ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {formatNumber(v.metrics.viewsPerDay)}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {v.metrics.engagementRate != null ? `${v.metrics.engagementRate.toFixed(2)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {v.metrics.commentsPer1000Views != null ? v.metrics.commentsPer1000Views.toFixed(1) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {v.metrics.likesPer1000Views != null ? v.metrics.likesPer1000Views.toFixed(1) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!loading && totalPages > 1 && (
        <div className="flex justify-center pt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="flex h-9 min-w-9 items-center justify-center text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
