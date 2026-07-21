'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';

// Updated interface to match the response from /api/hwar/harvests
interface IngestJob {
  id: string;
  query: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  orderBy: string | null;
  videoDuration: string | null;
  maxResults: number | null;
  safeSearch: string | null;
  videoDefinition: string | null;
  createdAt: string;
  errorMessage: string | null;
  // Fields that may be missing in the new API response
  publishedAfter?: string | null;
  duration?: number | null;
  error?: string | null;
  retryCount?: number;
  updatedAt?: string;
  regionCode?: string | null;
  relevanceLanguage?: string | null;
  searchType?: string | null;
  videoCaption?: string | null;
  videoEmbeddable?: boolean | null;
  videoLicense?: string | null;
  eventType?: string | null;
  lastCheckedAt?: string | null;
  stage?: string;
  externalId?: string | null;
  idempotencyKey?: string | null;
}

/**
 * Компонент таблицы для отображения задач ингеста
 */
export function IngestJobsTable() {
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchJobs = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const response = await fetch('/api/hwar/harvests', { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let data: IngestJob[];
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Invalid JSON response from /api/hwar/harvests');
      }

      // Set jobs directly since the new endpoint returns the array directly
      setJobs(data);
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      console.error('Error fetching jobs:', err);
      setError('Ошибка загрузки задач');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    fetchJobs(controllerRef.current.signal);
  };

  useEffect(() => {
    controllerRef.current = new AbortController();
    fetchJobs(controllerRef.current.signal);

    // Автообновление каждые 10 секунд с отменой предыдущего запроса
    const interval = setInterval(() => {
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();
      fetchJobs(controllerRef.current.signal);
    }, 10000);

    return () => {
      controllerRef.current?.abort();
      clearInterval(interval);
    };
  }, []);

  const getStatusBadge = (status: IngestJob['status']) => {
    const variants = {
      pending: 'secondary',
      processing: 'default',
      completed: 'success',
      failed: 'destructive',
    } as const;

    const labels = {
      pending: 'Ожидает',
      processing: 'Обработка',
      completed: 'Завершено',
      failed: 'Ошибка',
    };

    return (
      <Badge variant={variants[status] as any}>
        {labels[status]}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (duration: string | null | undefined) => {
    if (!duration) return '—';
    const labels: Record<string, string> = {
      any: 'Любая',
      short: 'Короткие',
      medium: 'Средние',
      long: 'Длинные',
    };
    return labels[duration] || duration;
  };

  const formatOrder = (order: string | null | undefined) => {
    if (!order) return '—';
    const labels: Record<string, string> = {
      date: 'По дате',
      relevance: 'По релевантности',
      viewCount: 'По просмотрам',
      rating: 'По рейтингу',
    };
    return labels[order] || order;
  };

  const formatDefinition = (definition: string | null | undefined) => {
    if (!definition) return '—';
    const labels: Record<string, string> = {
      any: 'Любое',
      high: 'HD',
      standard: 'SD',
    };
    return labels[definition] || definition;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>История задач ингеста</CardTitle>
            <CardDescription>
              Последние 50 задач поиска и загрузки видео
            </CardDescription>
          </div>
          <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm">
            {loading ? 'Загрузка...' : 'Обновить'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {loading && jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Загрузка задач...
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Нет задач для отображения
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Статус</TableHead>
                  <TableHead className="min-w-[200px]">Запрос</TableHead>
                  <TableHead>Сортировка</TableHead>
                  <TableHead>Длительность</TableHead>
                  <TableHead>Макс</TableHead>
                  <TableHead>Качество</TableHead>
                  <TableHead className="min-w-[150px]">Создано</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="font-medium">
                      <div className="max-w-[300px] truncate" title={job.query}>
                        {job.query}
                      </div>
                      {(job.errorMessage || job.error) && (
                        <div className="text-xs text-destructive mt-1 truncate" title={job.errorMessage || job.error || ''}>
                          {job.errorMessage || job.error}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatOrder(job.orderBy)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDuration(job.videoDuration)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.maxResults || 25}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDefinition(job.videoDefinition)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(job.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}