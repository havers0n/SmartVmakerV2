"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

type Run = {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  videoCount: number;
  uniqueChannelCount: number;
};

type DiscoveredVideo = {
  videoId: string;
  youtubeId: string | null;
  query: string;
  searchOrder: string;
  resultPosition: number;
  title: string;
  channelTitle: string | null;
  viewCount: number | null;
  publishedAt: string | null;
};

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function DiscoveryRunPage({
  params,
}: {
  params: { runId: string };
}) {
  const runQuery = useQuery<Run>({
    queryKey: ["discovery-run", params.runId],
    queryFn: () => api(`/api/discovery-runs/${params.runId}`),
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 3000 : false,
  });
  const videosQuery = useQuery<DiscoveredVideo[]>({
    queryKey: ["discovery-run", params.runId, "videos"],
    queryFn: () => api(`/api/discovery-runs/${params.runId}/videos`),
    refetchInterval: runQuery.data?.status === "running" ? 3000 : false,
  });
  const run = runQuery.data;
  const error = runQuery.error ?? videosQuery.error;

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/discovery">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to discovery
        </Link>
      </Button>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Discovery run</h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {params.runId}
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {run && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Status</CardTitle>
              </CardHeader>
              <CardContent className="capitalize">{run.status}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Found videos</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {run.videoCount}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Unique channels</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {run.uniqueChannelCount}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Timing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <p>Started: {formatDate(run.startedAt)}</p>
                <p>Finished: {formatDate(run.finishedAt)}</p>
              </CardContent>
            </Card>
          </div>
          {run.errorMessage && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {run.errorMessage}
            </p>
          )}
        </>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Discovered videos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>#</TableHead>
                <TableHead>Video</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(videosQuery.data ?? []).map((video) => (
                <TableRow
                  key={`${video.videoId}-${video.query}-${video.searchOrder}`}
                >
                  <TableCell>{video.query}</TableCell>
                  <TableCell>{video.searchOrder}</TableCell>
                  <TableCell>{video.resultPosition}</TableCell>
                  <TableCell className="min-w-64 font-medium">
                    {video.youtubeId ? (
                      <a
                        className="hover:underline"
                        href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {video.title}
                      </a>
                    ) : (
                      video.title
                    )}
                  </TableCell>
                  <TableCell>{video.channelTitle ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {video.viewCount?.toLocaleString() ?? "—"}
                  </TableCell>
                  <TableCell>{formatDate(video.publishedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!videosQuery.isLoading && !videosQuery.data?.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No discovered videos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
