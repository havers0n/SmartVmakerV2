'use client';

import { useEffect, useState } from 'react';
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
}

interface IngestJobsResponse {
  success: boolean;
  jobs: IngestJob[];
  message: string;
}

/**
 * Компонент таблицы для отображения задач ингеста
 */
export function IngestJobsTable() {
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ingest/jobs');
      const data: IngestJobsResponse = await response.json();

      if (data.success) {
        setJobs(data.jobs);
        setError(null);
      } else {
        setError('Не удалось загрузить задачи');
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError('Ошибка загрузки задач');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Автообновление каждые 10 секунд
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
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

  const formatDuration = (duration: string | null) => {
    if (!duration) return '—';
    const labels: Record<string, string> = {
      any: 'Любая',
      short: 'Короткие',
      medium: 'Средние',
      long: 'Длинные',
    };
    return labels[duration] || duration;
  };

  const formatOrder = (order: string | null) => {
    if (!order) return '—';
    const labels: Record<string, string> = {
      date: 'По дате',
      relevance: 'По релевантности',
      viewCount: 'По просмотрам',
      rating: 'По рейтингу',
    };
    return labels[order] || order;
  };

  const formatDefinition = (definition: string | null) => {
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
          <Button onClick={fetchJobs} disabled={loading} variant="outline" size="sm">
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
                      {job.errorMessage && (
                        <div className="text-xs text-destructive mt-1 truncate" title={job.errorMessage}>
                          {job.errorMessage}
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
