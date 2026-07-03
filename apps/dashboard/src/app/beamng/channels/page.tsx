'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Users, Search, Eye, Film, BarChart3, Calendar } from 'lucide-react';

interface BeamngChannel {
  id: string;
  youtubeChannelId: string;
  handle: string | null;
  title: string | null;
  description: string | null;
  country: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  aggregates: {
    totalVideos: number;
    totalViews: number;
    avgViewsPerVideo: number | null;
    avgViewsPerDay: number | null;
    latestVideoDate: string | null;
  };
}

function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BeamngChannelsPage() {
  const [channels, setChannels] = useState<BeamngChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const limit = 50;
  const totalPages = Math.ceil(total / limit);

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (search) params.set('search', search);
      const res = await fetch(`/api/beamng/channels?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setChannels(data.channels || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            BeamNG Channels
          </h1>
          <p className="text-muted-foreground mt-1">
            YouTube channels with aggregate video metrics.
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-0">
          {loading && (
            <div className="p-8 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          )}

          {!loading && channels.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No channels yet</p>
              <p className="text-sm">Import channels to see aggregated data here.</p>
            </div>
          )}

          {!loading && channels.length > 0 && (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1"><Users className="h-3 w-3" /> Subscribers</div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1"><Eye className="h-3 w-3" /> Total Views</div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1"><Film className="h-3 w-3" /> Videos</div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1"><BarChart3 className="h-3 w-3" /> Avg Views/Video</div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1"><BarChart3 className="h-3 w-3" /> Avg Views/Day</div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1"><Calendar className="h-3 w-3" /> Latest Video</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((ch) => (
                  <TableRow key={ch.id} className="border-border/50 hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {ch.thumbnailUrl ? (
                          <img src={ch.thumbnailUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                            <Users className="h-4 w-4 opacity-30" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-foreground">{ch.title || ch.handle || ch.youtubeChannelId}</span>
                          {ch.handle && <span className="text-xs text-muted-foreground">{ch.handle}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {ch.subscriberCount != null ? formatNumber(ch.subscriberCount) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {ch.viewCount != null ? formatNumber(ch.viewCount) : formatNumber(ch.aggregates.totalViews)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {ch.aggregates.totalVideos || '-'
                      }
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {ch.aggregates.avgViewsPerVideo != null ? formatNumber(ch.aggregates.avgViewsPerVideo) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {ch.aggregates.avgViewsPerDay != null ? formatNumber(ch.aggregates.avgViewsPerDay) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(ch.aggregates.latestVideoDate)}
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
                <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }} />
              </PaginationItem>
              <PaginationItem>
                <span className="flex h-9 min-w-9 items-center justify-center text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
