'use client';

import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/ui/empty-state';

const formSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  duration: z.enum(['short', 'medium', 'long']),
  publishedAfter: z.string().optional(),
});

type IngestFormData = z.infer<typeof formSchema>;

export default function IngestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const form = useForm<IngestFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: '',
      duration: 'short',
    },
  });

  const onSubmit = async (data: IngestFormData) => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/ingest/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create ingest job');
      }

      setResult(responseData);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-6">
      <Card>
        <CardHeader>
          <CardTitle>Ingest Videos from YouTube</CardTitle>
          <CardDescription>Search for YouTube videos and ingest them into the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Search Query</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., emotional architecture, storytelling"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter keywords to search for YouTube videos
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video Duration</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="short">Short (&lt; 4 minutes)</SelectItem>
                        <SelectItem value="medium">Medium (4-20 minutes)</SelectItem>
                        <SelectItem value="long">Long (&gt; 20 minutes)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Filter videos by duration
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publishedAfter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Published After (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Only get videos published after this date
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={loading}>
                {loading ? 'Creating job...' : 'Create Ingest Job'}
              </Button>
            </form>
          </Form>

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
              <p>Ingest job created with ID: <code>{result.jobId}</code></p>
              <p>Status: <strong>{result.status}</strong></p>
              <p>{result.message}</p>

              <div className="mt-4 text-sm text-muted-foreground">
                <p>💡 The worker will now search YouTube and fetch video metadata.</p>
                <p>Check the Analysis page to see new videos.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2">
            <li>Enter a search query (e.g., &quot;emotional architecture&quot;)</li>
            <li>Optionally filter by duration and publication date</li>
            <li>Click &quot;Create Ingest Job&quot;</li>
            <li>The ingest worker will search YouTube API</li>
            <li>Videos will be stored in the database</li>
            <li>You can then analyze them on the Analysis page</li>
          </ol>

          <h3 className="mt-4 font-semibold">About Duration</h3>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>Short:</strong> Less than 4 minutes - Great for clips</li>
            <li><strong>Medium:</strong> 4 to 20 minutes - Typical videos</li>
            <li><strong>Long:</strong> More than 20 minutes - Deep dive content</li>
          </ul>

          <p className="mt-4 text-sm text-muted-foreground">
            <strong>Note:</strong> YouTube API has daily quotas. Each search uses ~100 quota units.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}