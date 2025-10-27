'use client';

import { FormEvent, useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import { Film, Image } from 'lucide-react';

interface Short {
  id: string;
  templateId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
  assetCount?: number;
  completedCount?: number;
  failedCount?: number;
}

interface Asset {
  id: string;
  shortId: string;
  assetType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  storageUrl?: string;
  apiCostUsd?: number;
  meta?: Record<string, any>;
  error?: string;
  createdAt: string;
}

interface GenerationJob {
  id: string;
  assetId: string;
  provider: 'minimax' | 'hailuo';
  status: 'pending' | 'processing' | 'done' | 'failed';
  error?: string;
}

interface StatusResponse {
  ok: boolean;
  shorts: Short[];
  assets: Asset[];
  jobs: GenerationJob[];
  count: {
    shorts: number;
    assets: number;
    jobs: number;
  };
}

export default function GenerationPage() {
  const [templateId, setTemplateId] = useState('');
  const [provider, setProvider] = useState<'minimax' | 'hailuo'>('minimax');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch generation status
  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await fetch('/api/generation/status?limit=100');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch status');
      }

      setStatusData(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  // Auto-refresh every 3 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchStatus, 3000);
    fetchStatus(); // Initial fetch

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleCreateShort = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!templateId.trim()) {
      setError('Template ID is required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/generation/shorts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: templateId.trim(),
          provider,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create short');
      }

      setSuccess(`Short created: ${data.shortId} with ${data.enqueued} assets enqueued`);
      setTemplateId('');

      // Refresh status immediately
      setTimeout(fetchStatus, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      case 'processing': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="container py-6">
      <Card>
        <CardHeader>
          <CardTitle>Generation & Asset Creation</CardTitle>
          <CardDescription>Create shorts from templates and generate video assets using MiniMax or Hailuo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateShort} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="templateId">Template ID</Label>
                <Input
                  id="templateId"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder="e.g., template-001"
                  disabled={loading}
                />
                <p className="text-sm text-muted-foreground">
                  The ID of the template to base the short on
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={provider} onValueChange={(value) => setProvider(value as 'minimax' | 'hailuo')}>
                  <SelectTrigger disabled={loading}>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimax">MiniMax</SelectItem>
                    <SelectItem value="hailuo">Hailuo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Video generation provider to use
                </p>
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Short'}
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-success/10 text-success rounded-md">
              {success}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Generation Status</CardTitle>
              <CardDescription>Monitor your generation jobs and assets</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={autoRefresh}
                  onCheckedChange={(checked) => setAutoRefresh(checked as boolean)}
                />
                Auto-refresh (3s)
              </Label>
              <Button
                onClick={fetchStatus}
                disabled={loadingStatus}
                variant="outline"
              >
                {loadingStatus ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {statusData ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{statusData.count.shorts}</div>
                    <div className="text-sm text-muted-foreground">Shorts</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-success">{statusData.count.assets}</div>
                    <div className="text-sm text-muted-foreground">Assets</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-warning">{statusData.count.jobs}</div>
                    <div className="text-sm text-muted-foreground">Jobs</div>
                  </CardContent>
                </Card>
              </div>

              {/* Shorts Table */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Shorts</h3>
                {statusData.shorts.length === 0 ? (
                  <EmptyState
                    icon={Film}
                    title="No shorts yet"
                    description="Create a short using the form above to get started."
                  />
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Template</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Assets</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusData.shorts.map((short) => (
                          <TableRow key={short.id}>
                            <TableCell className="font-mono text-sm">
                              {short.id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>{short.templateId}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(short.status)}>
                                {short.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {short.completedCount}/{short.assetCount}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(short.createdAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Assets Table */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Assets ({statusData.count.assets})</h3>
                {statusData.assets.length === 0 ? (
                  <EmptyState
                    icon={Image}
                    title="No assets yet"
                    description="Assets will appear here once shorts are created."
                  />
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Short ID</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Storage URL</TableHead>
                          <TableHead>Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusData.assets.map((asset) => (
                          <TableRow key={asset.id}>
                            <TableCell className="font-mono text-sm">
                              {asset.shortId.substring(0, 8)}...
                            </TableCell>
                            <TableCell>{asset.assetType}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(asset.status)}>
                                {asset.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {asset.storageUrl ? (
                                <a 
                                  href={asset.storageUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-primary hover:underline"
                                >
                                  View
                                </a>
                              ) : (
                                <span className="text-muted-foreground">Pending...</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {asset.apiCostUsd ? `$${asset.apiCostUsd.toFixed(4)}` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[300px]" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}