"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
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
type Video = {
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
type Evidence = {
  videoId: string;
  title: string;
  publishedAt: string | null;
  viewCount: number | null;
  queryId: string;
  query: string;
  searchOrder: string;
  resultPosition: number;
};
type Channel = {
  channelId: string;
  channelTitle: string | null;
  channelPublishedAt: string | null;
  channelAgeDays: number | null;
  subscriberCount: number | null;
  totalViewCount: number | null;
  channelVideoCount: number | null;
  matchedVideoCount: number;
  latestMatchedVideoAt: string | null;
  medianMatchedVideoViews: number;
  bestMatchedVideoViews: number;
  viewsPerSubscriber: number | null;
  evidenceVideos: Evidence[];
};
type SortKey = keyof Pick<
  Channel,
  | "channelTitle"
  | "channelAgeDays"
  | "subscriberCount"
  | "totalViewCount"
  | "matchedVideoCount"
  | "latestMatchedVideoAt"
  | "medianMatchedVideoViews"
  | "bestMatchedVideoViews"
  | "viewsPerSubscriber"
>;

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body;
}
const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "—";
const formatNumber = (value: number | null) => value?.toLocaleString() ?? "—";

function SortHead({
  label,
  column,
  onSort,
}: {
  label: string;
  column: SortKey;
  onSort: (key: SortKey) => void;
}) {
  return (
    <TableHead>
      <Button variant="ghost" size="sm" onClick={() => onSort(column)}>
        {label}
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    </TableHead>
  );
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
  const videosQuery = useQuery<Video[]>({
    queryKey: ["discovery-run", params.runId, "videos"],
    queryFn: () => api(`/api/discovery-runs/${params.runId}/videos`),
    refetchInterval: runQuery.data?.status === "running" ? 3000 : false,
  });
  const channelsQuery = useQuery<Channel[]>({
    queryKey: ["discovery-run", params.runId, "channels"],
    queryFn: () => api(`/api/discovery-runs/${params.runId}/channels`),
    refetchInterval: runQuery.data?.status === "running" ? 3000 : false,
  });
  const [filters, setFilters] = useState({
    maxAge: "",
    minMatched: "",
    minSubs: "",
    maxSubs: "",
    minMedian: "",
  });
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({
    key: "matchedVideoCount",
    direction: -1,
  });
  const channels = useMemo(() => {
    const n = (value: string) => (value === "" ? null : Number(value));
    return (channelsQuery.data ?? [])
      .filter(
        (channel) =>
          (n(filters.maxAge) === null ||
            (channel.channelAgeDays !== null &&
              channel.channelAgeDays <= n(filters.maxAge)! * 30.4375)) &&
          (n(filters.minMatched) === null ||
            channel.matchedVideoCount >= n(filters.minMatched)!) &&
          (n(filters.minSubs) === null ||
            Number(channel.subscriberCount ?? 0) >= n(filters.minSubs)!) &&
          (n(filters.maxSubs) === null ||
            Number(channel.subscriberCount ?? 0) <= n(filters.maxSubs)!) &&
          (n(filters.minMedian) === null ||
            channel.medianMatchedVideoViews >= n(filters.minMedian)!),
      )
      .sort((a, b) => {
        const left = a[sort.key],
          right = b[sort.key];
        if (sort.key === "latestMatchedVideoAt")
          return (
            (Date.parse(String(left ?? "1970-01-01")) -
              Date.parse(String(right ?? "1970-01-01"))) *
            sort.direction
          );
        return (
          String(left ?? "").localeCompare(String(right ?? ""), undefined, {
            numeric: true,
          }) * sort.direction
        );
      });
  }, [channelsQuery.data, filters, sort]);
  const changeSort = (key: SortKey) =>
    setSort((current) => ({
      key,
      direction:
        current.key === key ? ((current.direction * -1) as 1 | -1) : -1,
    }));
  const run = runQuery.data;
  const error = runQuery.error ?? videosQuery.error ?? channelsQuery.error;

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
            {[
              ["Status", run.status],
              ["Found videos", run.videoCount],
              ["Unique channels", run.uniqueChannelCount],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-sm">{label}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold capitalize">
                  {value}
                </CardContent>
              </Card>
            ))}
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
      <Tabs defaultValue="videos">
        <TabsList>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>
        <TabsContent value="videos">
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
                    <TableHead>Views</TableHead>
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
                      <TableCell>{formatNumber(video.viewCount)}</TableCell>
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
        </TabsContent>
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Channel filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["maxAge", "Max age (months)"],
                ["minMatched", "Min matched videos"],
                ["minSubs", "Min subscribers"],
                ["maxSubs", "Max subscribers"],
                ["minMedian", "Min median views"],
              ].map(([key, label]) => (
                <div className="space-y-1" key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    min="0"
                    value={filters[key as keyof typeof filters]}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Discovered channels</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead
                      label="Channel"
                      column="channelTitle"
                      onSort={changeSort}
                    />
                    <SortHead
                      label="Age"
                      column="channelAgeDays"
                      onSort={changeSort}
                    />
                    <SortHead
                      label="Subscribers"
                      column="subscriberCount"
                      onSort={changeSort}
                    />
                    <SortHead
                      label="Total views"
                      column="totalViewCount"
                      onSort={changeSort}
                    />
                    <SortHead
                      label="Matched videos"
                      column="matchedVideoCount"
                      onSort={changeSort}
                    />
                    <SortHead
                      label="Latest matched video"
                      column="latestMatchedVideoAt"
                      onSort={changeSort}
                    />
                    <SortHead
                      label="Median views"
                      column="medianMatchedVideoViews"
                      onSort={changeSort}
                    />
                    <SortHead
                      label="Best video"
                      column="bestMatchedVideoViews"
                      onSort={changeSort}
                    />
                    <SortHead
                      label="Views/sub"
                      column="viewsPerSubscriber"
                      onSort={changeSort}
                    />
                    <TableHead>Evidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels.map((channel) => (
                    <TableRow key={channel.channelId}>
                      <TableCell className="min-w-48 font-medium">
                        <a
                          className="hover:underline"
                          href={`https://www.youtube.com/channel/${channel.channelId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {channel.channelTitle ?? channel.channelId}
                        </a>
                      </TableCell>
                      <TableCell>
                        {channel.channelAgeDays === null
                          ? "—"
                          : `${Math.floor(channel.channelAgeDays / 30.4375)} mo`}
                      </TableCell>
                      <TableCell>
                        {formatNumber(channel.subscriberCount)}
                      </TableCell>
                      <TableCell>
                        {formatNumber(channel.totalViewCount)}
                      </TableCell>
                      <TableCell>{channel.matchedVideoCount}</TableCell>
                      <TableCell>
                        {formatDate(channel.latestMatchedVideoAt)}
                      </TableCell>
                      <TableCell>
                        {formatNumber(channel.medianMatchedVideoViews)}
                      </TableCell>
                      <TableCell>
                        {formatNumber(channel.bestMatchedVideoViews)}
                      </TableCell>
                      <TableCell>
                        {channel.viewsPerSubscriber?.toFixed(2) ?? "—"}
                      </TableCell>
                      <TableCell className="min-w-72">
                        <details>
                          <summary className="cursor-pointer">
                            {channel.evidenceVideos.length} search hits
                          </summary>
                          <ul className="mt-2 space-y-2 text-xs">
                            {channel.evidenceVideos.map((video, index) => (
                              <li
                                key={`${video.videoId}-${video.queryId}-${video.searchOrder}-${index}`}
                              >
                                <a
                                  className="font-medium hover:underline"
                                  href={`https://www.youtube.com/watch?v=${video.videoId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {video.title}
                                </a>
                                <div className="text-muted-foreground">
                                  {video.query} · {video.searchOrder} #
                                  {video.resultPosition} ·{" "}
                                  {formatNumber(video.viewCount)} views
                                </div>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!channelsQuery.isLoading && !channels.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No channels match the filters.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
