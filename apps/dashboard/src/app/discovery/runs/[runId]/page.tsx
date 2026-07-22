"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpDown, Clipboard, Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
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
import { AddToContentFormatDialog } from "@/features/discovery-content-formats/add-to-content-format-dialog";

type Run = {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  videoCount: number;
  uniqueChannelCount: number;
  aiSummary: string | null;
  cancelRequestedAt: string | null;
  requestBudget: number;
  externalRequestCount: number;
  progress?: { totalSteps: number; completed: number; pending: number; processing: number; retry_wait: number; failed: number; cancelled: number; blocked_quota: number; pagesCompleted: number; lastError: string | null };
};
type ResearchCandidate = {
  id: string;
  label: string;
  summary: string;
  researchScore: number;
  adjustedResearchScore: number;
  labelQualityScore: number;
  dominantLanguage: string;
  languageMatchScore: number;
  contentFormat: string;
  audience: string;
  suggestedQueries: string[];
  whyResearchable: string;
  semanticCohesion: number;
  repeatedFormatEvidence: number;
  isOutlier: boolean;
  videoCount: number;
  channelCount: number;
  medianViewsPerDay: number;
  smallChannelCount: number;
  why_boosted: string[];
  why_penalized: string[];
  language_script_score: number;
  shorts_evidence_ratio: number;
  representativeTitles: string[];
  representativeChannels: { channelId: string; title: string | null }[];
  representativeVideos: {
    youtubeId: string | null;
    title: string;
    channelTitle: string | null;
  }[];
  format_name: string;
  confidence_score: number;
  format_summary: string;
  common_hooks: string[];
  common_title_patterns: string[];
  common_emotions: string[];
  typical_duration_range: string;
  likely_visual_style: string;
  repeatability_score: number;
  example_videos: string[];
  example_channels: string[];
  export_to_research: { status: "placeholder"; label: string };
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
type CurationVideo = {
  videoId: string;
  youtubeId: string | null;
  url: string;
  title: string;
  channelTitle: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
  viewsPerDay: number;
  language: string;
  isExcluded: boolean;
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
  queryCoverage: number;
  latestMatchedVideoAt: string | null;
  medianMatchedVideoViews: number;
  bestMatchedVideoViews: number;
  medianViewsPerDay: number;
  bestViewsPerDay: number;
  uploadRecencyDays: number | null;
  recencyScore: number;
  viewsPerSubscriber: number | null;
  viewsPerSubscriberScore: number;
  relevanceScore: number;
  evidenceVideos: Evidence[];
};
type SortKey = keyof Pick<
  Channel,
  | "channelTitle"
  | "channelAgeDays"
  | "subscriberCount"
  | "totalViewCount"
  | "matchedVideoCount"
  | "queryCoverage"
  | "latestMatchedVideoAt"
  | "medianMatchedVideoViews"
  | "bestMatchedVideoViews"
  | "medianViewsPerDay"
  | "bestViewsPerDay"
  | "viewsPerSubscriber"
  | "relevanceScore"
>;

type OpportunitySignal = {
  label: string;
  value: string | number;
  description?: string;
};
type RisingSmallChannel = {
  channelId: string;
  channelTitle: string | null;
  subscriberCount: number | null;
  matchedVideoCount: number;
  medianViewsPerDay: number;
  bestViewsPerDay: number;
  queryCoverage: number;
  relevanceScore: number;
  topEvidenceVideoTitle: string | null;
};
type OutlierVideoInfo = {
  videoId: string;
  title: string;
  channelTitle: string | null;
  subscriberCount: number | null;
  viewCount: number | null;
  viewsPerDay: number;
  publishedAt: string | null;
  query: string;
  outlierScore: number;
  confidence: "low" | "medium" | "high";
};
type TokenFrequency = { token: string; count: number };
type RepeatedPattern = {
  name: string;
  videoCount: number;
  uniqueChannels: number;
  medianViewsPerDay: number;
  bestViewsPerDay: number;
};
type TitleTokenCohesionResult = {
  topTokens: TokenFrequency[];
  tokenCoverage: number;
  topTokenConcentration: number;
};
type ChannelRepeatabilityResult = {
  channelsWithMultipleVideos: number;
  uniqueChannels: number;
  repeatChannelRatio: number;
  avgVideosPerChannel: number;
  topChannelDominance: number;
};
type QueryOverlapResult = {
  averageQueryChannelOverlap: number;
  averageQueryTokenOverlap: number;
  queryOverlapScore: number;
};
type NicheCohesionMetrics = {
  titleTokenCohesion: TitleTokenCohesionResult;
  repeatedPatterns: RepeatedPattern[];
  patternCoverage: number;
  channelRepeatability: ChannelRepeatabilityResult;
  queryOverlap: QueryOverlapResult;
  nicheCohesionScore: number;
  cohesionLabel: string;
  broadnessWarnings: string[];
  suggestedNarrowedQueries: string[];
};
type QueryPerformanceInfo = {
  query: string;
  totalDiscoveredVideos: number;
  uniqueChannels: number;
  knownSubscriberChannels: number;
  unknownSubscriberChannels: number;
  smallChannelsCount: number;
  medianViewsPerDay: number;
  bestViewsPerDay: number;
  outlierCount: number;
  queryQualityScore: number;
  knownSubscriberCoverage: number;
  dataQualityWarning?: string;
  cohesionContribution?: number;
  genericQueryWarning?: string;
  branchMatches?: string[];
};
type SubscriberDataQuality = {
  knownCount: number;
  unknownCount: number;
  zeroSubscriberCount: number;
  suspiciousZeroSubscriberCount: number;
  knownCoverage: number;
};
type ExampleVideo = {
  title: string;
  channelTitle: string;
  viewsPerDay: number;
  url?: string;
};
type NicheBranchSuggestion = {
  id: string;
  name: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  sourceTokens: string[];
  sourcePatterns: string[];
  evidenceVideoCount: number;
  evidenceChannelCount: number;
  medianViewsPerDay: number;
  bestViewsPerDay: number;
  smallKnownChannelCount: number;
  suggestedQueries: string[];
  exampleVideos: ExampleVideo[];
  branchScore: number;
  specificTokenMatchStrength: number;
};
type OpportunityData = {
  signals: OpportunitySignal[];
  risingSmallChannels: RisingSmallChannel[];
  outlierVideos: OutlierVideoInfo[];
  queryPerformance: QueryPerformanceInfo[];
  dataQualityWarning?: string;
  subscriberDataQuality?: SubscriberDataQuality;
  nicheCohesion?: NicheCohesionMetrics;
  nicheBranches?: NicheBranchSuggestion[];
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

async function downloadResearchCandidateCsv(runId: string, candidateId: string) {
  const response = await fetch(
    `/api/discovery-runs/${runId}/candidates/${candidateId}/export`,
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "CSV export failed");
  }
  const blob = await response.blob();
  const filename =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="([^"]+)"/)?.[1] ?? "research-candidate.csv";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "—";
const formatNumber = (value: number | null) => value?.toLocaleString() ?? "—";
const formatSubs = (value: number | null) =>
  value != null ? value.toLocaleString() : "Unknown";

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

const formatDuration = (seconds: number | null) => {
  if (seconds == null) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};

function FormatCurationDialog({ runId, candidate, open, onOpenChange }: {
  runId: string;
  candidate: ResearchCandidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [filters, setFilters] = useState({ shortsOnly: false, language: "", minViewsPerDay: "", channel: "" });
  const videosQuery = useQuery<CurationVideo[]>({
    queryKey: ["discovery-run", runId, "candidate-curation", candidate?.id],
    queryFn: () => api(`/api/discovery-runs/${runId}/candidates/${candidate!.id}`),
    enabled: open && Boolean(candidate),
  });
  const save = async (videoIds: string[], isExcluded: boolean) => {
    if (!candidate || !videoIds.length) return;
    const response = await fetch(`/api/discovery-runs/${runId}/candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoIds, isExcluded }),
    });
    if (!response.ok) throw new Error("Could not save curation");
    await videosQuery.refetch();
  };
  const videos = videosQuery.data ?? [];
  const visibleVideos = videos.filter((video) =>
    (!filters.shortsOnly || (video.durationSeconds != null && video.durationSeconds <= 90)) &&
    (!filters.language || video.language.toLowerCase().includes(filters.language.toLowerCase())) &&
    (!filters.minViewsPerDay || video.viewsPerDay >= Number(filters.minViewsPerDay)) &&
    (!filters.channel || (video.channelTitle ?? "").toLowerCase().includes(filters.channel.toLowerCase())),
  );
  const selectedIds = videos.filter((video) => !video.isExcluded).map((video) => video.videoId);
  const excludedIds = videos.filter((video) => video.isExcluded).map((video) => video.videoId);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Curate {candidate?.format_name}</DialogTitle>
        <DialogDescription>Selection is saved for this Discovery run and format. CSV exports include only selected videos.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={filters.shortsOnly} onCheckedChange={(checked) => setFilters((current) => ({ ...current, shortsOnly: checked === true }))} /> Shorts only ≤90 sec</label>
        <div><Label htmlFor="curation-language">Language</Label><Input id="curation-language" value={filters.language} onChange={(event) => setFilters((current) => ({ ...current, language: event.target.value }))} /></div>
        <div><Label htmlFor="curation-vpd">Minimum views/day</Label><Input id="curation-vpd" type="number" min="0" value={filters.minViewsPerDay} onChange={(event) => setFilters((current) => ({ ...current, minViewsPerDay: event.target.value }))} /></div>
        <div><Label htmlFor="curation-channel">Channel</Label><Input id="curation-channel" value={filters.channel} onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => save(excludedIds, false)}>Select all</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => save(selectedIds, true)}>Clear all</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => save(selectedIds, true)}>Exclude selected</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => save(excludedIds, false)}>Restore excluded</Button>
        <span className="text-sm text-muted-foreground">{selectedIds.length} of {videos.length} selected</span>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Select</TableHead><TableHead>Title</TableHead><TableHead>Channel</TableHead><TableHead>Duration</TableHead><TableHead>Views</TableHead><TableHead>Views/day</TableHead><TableHead>Language</TableHead><TableHead>YouTube</TableHead></TableRow></TableHeader>
          <TableBody>{visibleVideos.map((video) => <TableRow key={video.videoId} className={video.isExcluded ? "opacity-50" : undefined}>
            <TableCell><Checkbox aria-label={`Select ${video.title}`} checked={!video.isExcluded} onCheckedChange={(checked) => save([video.videoId], checked !== true)} /></TableCell>
            <TableCell className="min-w-64 font-medium">{video.title}</TableCell><TableCell>{video.channelTitle ?? "—"}</TableCell><TableCell>{formatDuration(video.durationSeconds)}</TableCell><TableCell>{formatNumber(video.viewCount)}</TableCell><TableCell>{formatNumber(Math.round(video.viewsPerDay))}</TableCell><TableCell>{video.language.toUpperCase()}</TableCell>
            <TableCell>{video.youtubeId ? <a className="hover:underline" href={video.url || `https://www.youtube.com/watch?v=${video.youtubeId}`} target="_blank" rel="noreferrer">Open</a> : "—"}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
      {!videosQuery.isLoading && !visibleVideos.length && <p className="text-center text-sm text-muted-foreground">No videos match these filters.</p>}
    </DialogContent>
  </Dialog>;
}

export default function DiscoveryRunPage({
  params,
}: {
  params: { runId: string };
}) {
  const queryClient = useQueryClient();
  const runQuery = useQuery<Run>({
    queryKey: ["discovery-run", params.runId],
    queryFn: () => api(`/api/discovery-runs/${params.runId}`),
    refetchInterval: (query) =>
      ["queued", "running", "blocked"].includes(query.state.data?.status ?? "") ? 3000 : false,
  });
  const videosQuery = useQuery<Video[]>({
    queryKey: ["discovery-run", params.runId, "videos"],
    queryFn: () => api(`/api/discovery-runs/${params.runId}/videos`),
    refetchInterval: ["queued", "running", "blocked"].includes(runQuery.data?.status ?? "") ? 3000 : false,
  });
  const channelsQuery = useQuery<Channel[]>({
    queryKey: ["discovery-run", params.runId, "channels"],
    queryFn: () => api(`/api/discovery-runs/${params.runId}/channels`),
    refetchInterval: ["queued", "running", "blocked"].includes(runQuery.data?.status ?? "") ? 3000 : false,
  });
  const opportunityQuery = useQuery<OpportunityData>({
    queryKey: ["discovery-run", params.runId, "opportunity"],
    queryFn: () => api(`/api/discovery-runs/${params.runId}/opportunity`),
    refetchInterval: ["queued", "running", "blocked"].includes(runQuery.data?.status ?? "") ? 3000 : false,
  });
  const candidatesQuery = useQuery<ResearchCandidate[]>({
    queryKey: ["discovery-run", params.runId, "candidates"],
    queryFn: () => api(`/api/discovery-runs/${params.runId}/candidates`),
    enabled: runQuery.data?.status === "completed",
  });
  const [exportingCandidateId, setExportingCandidateId] = useState<
    string | null
  >(null);
  const [copiedCandidateId, setCopiedCandidateId] = useState<string | null>(null);
  const [researchPlaceholderId, setResearchPlaceholderId] = useState<string | null>(null);
  const [curatingCandidate, setCuratingCandidate] = useState<ResearchCandidate | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(() => new Set());
  const [contentFormatDialogOpen, setContentFormatDialogOpen] = useState(false);
  useEffect(() => {
    setSelectedVideoIds(new Set());
    setContentFormatDialogOpen(false);
  }, [params.runId]);
  const [filters, setFilters] = useState({
    maxAge: "",
    minMatched: "",
    minSubs: "",
    maxSubs: "",
    minMedian: "",
    minScore: "",
    minCoverage: "",
    minMedianPerDay: "",
  });
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({
    key: "relevanceScore",
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
            channel.medianMatchedVideoViews >= n(filters.minMedian)!) &&
          (n(filters.minScore) === null ||
            channel.relevanceScore >= n(filters.minScore)!) &&
          (n(filters.minCoverage) === null ||
            channel.queryCoverage >= n(filters.minCoverage)!) &&
          (n(filters.minMedianPerDay) === null ||
            channel.medianViewsPerDay >= n(filters.minMedianPerDay)!),
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
  const videos = videosQuery.data ?? [];
  const selectedVideosOnPage = videos.filter((video) => selectedVideoIds.has(video.videoId));
  const allVideosOnPageSelected = videos.length > 0 && selectedVideosOnPage.length === videos.length;
  const toggleVideo = (videoId: string, checked: boolean) => setSelectedVideoIds((current) => {
    const next = new Set(current);
    if (checked) {
      if (next.size >= 250) return next;
      next.add(videoId);
    } else next.delete(videoId);
    return next;
  });
  const togglePageVideos = (checked: boolean) => setSelectedVideoIds((current) => {
    const next = new Set(current);
    if (!checked) {
      videos.forEach((video) => next.delete(video.videoId));
      return next;
    }
    for (const video of videos) {
      if (next.has(video.videoId)) continue;
      if (next.size >= 250) break;
      next.add(video.videoId);
    }
    return next;
  });
  const refreshRun = () => queryClient.invalidateQueries({ queryKey: ["discovery-run", params.runId] });
  const cancelRun = useMutation({ mutationFn: () => api(`/api/discovery-runs/${params.runId}/cancel`, { method: "POST" }), onSuccess: refreshRun });
  const resumeRun = useMutation({ mutationFn: () => api(`/api/discovery-runs/${params.runId}/resume`, { method: "POST" }), onSuccess: refreshRun });
  const error =
    runQuery.error ??
    videosQuery.error ??
    channelsQuery.error ??
    opportunityQuery.error ??
    candidatesQuery.error;

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
          {run.progress && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Execution progress</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{run.progress.completed} of {run.progress.totalSteps} planned steps completed; {run.progress.pagesCompleted} pages saved.</p>
                <p>Requests: {run.externalRequestCount} / {run.requestBudget}. Pending: {run.progress.pending}; processing: {run.progress.processing}; retrying: {run.progress.retry_wait}.</p>
                {run.progress.lastError && <p className="text-destructive">Latest error: {run.progress.lastError}</p>}
                <div className="flex gap-2">
                  {!["completed", "completed_with_errors", "failed", "cancelled"].includes(run.status) && <Button variant="destructive" onClick={() => cancelRun.mutate()} disabled={cancelRun.isPending}>Cancel</Button>}
                  {["failed", "cancelled", "blocked", "completed_with_errors"].includes(run.status) && <Button onClick={() => resumeRun.mutate()} disabled={resumeRun.isPending}>Resume / Retry</Button>}
                </div>
              </CardContent>
            </Card>
          )}
          {run.errorMessage && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {run.errorMessage}
            </p>
          )}
          {run.aiSummary && (
            <Card>
              <CardHeader>
                <CardTitle>AI run summary</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {run.aiSummary}
              </CardContent>
            </Card>
          )}
        </>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Opportunity Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {opportunityQuery.isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Analyzing run data…
            </p>
          ) : opportunityQuery.data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {opportunityQuery.data.signals.map((signal) => (
                  <Card key={signal.label}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">
                        {signal.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="truncate text-lg font-semibold">
                      {signal.value}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {opportunityQuery.data.subscriberDataQuality &&
                (() => {
                  const sdq = opportunityQuery.data.subscriberDataQuality!;
                  return (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground">
                            Known Subscriber Channels
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-lg font-semibold">
                          {sdq.knownCount}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground">
                            Unknown Subscriber Channels
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-lg font-semibold">
                          {sdq.unknownCount}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground">
                            Zero Subscriber Count
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-lg font-semibold">
                          {sdq.zeroSubscriberCount}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground">
                            Suspicious Zero Subs
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-lg font-semibold">
                          {sdq.suspiciousZeroSubscriberCount}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground">
                            Known Subscriber Coverage
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-lg font-semibold">
                          {(sdq.knownCoverage * 100).toFixed(0)}%
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}
              {opportunityQuery.data.dataQualityWarning && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                  {opportunityQuery.data.dataQualityWarning}
                </div>
              )}
              {opportunityQuery.data.nicheCohesion &&
                (() => {
                  const nc = opportunityQuery.data.nicheCohesion!;
                  const scorePct = (nc.nicheCohesionScore * 100).toFixed(0);
                  const scoreColor =
                    nc.nicheCohesionScore < 0.3
                      ? "text-red-500"
                      : nc.nicheCohesionScore < 0.6
                        ? "text-amber-500"
                        : nc.nicheCohesionScore < 0.8
                          ? "text-green-500"
                          : "text-emerald-500";
                  const labelColor =
                    nc.nicheCohesionScore < 0.3
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      : nc.nicheCohesionScore < 0.6
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        : nc.nicheCohesionScore < 0.8
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
                  return (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold">
                        Niche Cohesion
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">
                              Cohesion Score
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-3xl font-bold ${scoreColor}`}>
                              {scorePct}%
                            </div>
                            <span
                              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${labelColor}`}
                            >
                              {nc.cohesionLabel}
                            </span>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">
                              Title Token Coverage
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-semibold">
                            {(
                              nc.titleTokenCohesion.tokenCoverage * 100
                            ).toFixed(0)}
                            %
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">
                              Pattern Coverage
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-semibold">
                            {(nc.patternCoverage * 100).toFixed(0)}%
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">
                              Repeat Channel Ratio
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-semibold">
                            {(
                              nc.channelRepeatability.repeatChannelRatio * 100
                            ).toFixed(0)}
                            %
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">
                              Query Overlap
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-semibold">
                            {(nc.queryOverlap.queryOverlapScore * 100).toFixed(
                              0,
                            )}
                            %
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">
                              Avg Videos / Channel
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-semibold">
                            {nc.channelRepeatability.avgVideosPerChannel.toFixed(
                              2,
                            )}
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">
                              Top 5 Channel Dominance
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-semibold">
                            {(
                              nc.channelRepeatability.topChannelDominance * 100
                            ).toFixed(0)}
                            %
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">
                              Token Concentration
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-2xl font-semibold">
                            {(
                              nc.titleTokenCohesion.topTokenConcentration * 100
                            ).toFixed(0)}
                            %
                          </CardContent>
                        </Card>
                      </div>
                      {nc.broadnessWarnings.length > 0 && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                          {nc.nicheCohesionScore < 0.6 && (
                            <p className="mb-2 font-medium">
                              This run looks too broad for niche selection. It
                              found many unrelated formats/channels. Narrow the
                              seed queries before making a production decision.
                            </p>
                          )}
                          <ul className="list-inside list-disc space-y-1">
                            {nc.broadnessWarnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {nc.titleTokenCohesion.topTokens.length > 0 && (
                        <div>
                          <h4 className="mb-1 text-sm font-medium">
                            Top Repeated Tokens
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {nc.titleTokenCohesion.topTokens
                              .slice(0, 10)
                              .map((t) => (
                                <span
                                  key={t.token}
                                  className="rounded-md bg-muted px-2 py-0.5 text-xs"
                                >
                                  {t.token} ({t.count})
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                      {nc.repeatedPatterns.length > 0 && (
                        <div>
                          <h4 className="mb-1 text-sm font-medium">
                            Top Repeated Patterns
                          </h4>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Pattern</TableHead>
                                  <TableHead>Videos</TableHead>
                                  <TableHead>Channels</TableHead>
                                  <TableHead>Median / day</TableHead>
                                  <TableHead>Best / day</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {nc.repeatedPatterns.map((p) => (
                                  <TableRow key={p.name}>
                                    <TableCell className="font-medium">
                                      {p.name}
                                    </TableCell>
                                    <TableCell>{p.videoCount}</TableCell>
                                    <TableCell>{p.uniqueChannels}</TableCell>
                                    <TableCell>
                                      {Math.round(
                                        p.medianViewsPerDay,
                                      ).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                      {Math.round(
                                        p.bestViewsPerDay,
                                      ).toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                      {nc.suggestedNarrowedQueries.length > 0 && (
                        <div>
                          <h4 className="mb-1 text-sm font-medium">
                            Suggested Narrowed Queries
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {nc.suggestedNarrowedQueries.map((q, i) => (
                              <span
                                key={i}
                                className="rounded-md border bg-card px-2 py-0.5 text-xs font-mono"
                              >
                                {q}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              {opportunityQuery.data.nicheBranches &&
                opportunityQuery.data.nicheBranches.length > 0 &&
                (() => {
                  const branches = opportunityQuery.data.nicheBranches!;
                  const nc = opportunityQuery.data.nicheCohesion;
                  const isBroad = nc ? nc.nicheCohesionScore < 0.6 : true;
                  return (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold">
                        Suggested Narrowing
                      </h3>
                      {isBroad ? (
                        <p className="text-sm text-muted-foreground">
                          This run is too broad. Use one of these focused
                          branches for the next discovery run.
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Optional adjacent branches to explore.
                        </p>
                      )}
                      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                        {branches.map((branch) => {
                          const confColor =
                            branch.confidence === "high"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : branch.confidence === "medium"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-muted text-muted-foreground";
                          return (
                            <Card key={branch.id} className="overflow-hidden">
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                  <CardTitle className="text-sm font-semibold leading-tight">
                                    {branch.name}
                                  </CardTitle>
                                  <span
                                    className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${confColor}`}
                                  >
                                    {branch.confidence}
                                  </span>
                                </div>
                                <p className="pt-1 text-xs text-muted-foreground">
                                  {branch.reason}
                                </p>
                              </CardHeader>
                              <CardContent className="space-y-3 pb-4">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                  <span>
                                    Videos:{" "}
                                    <strong>{branch.evidenceVideoCount}</strong>
                                  </span>
                                  <span>
                                    Channels:{" "}
                                    <strong>
                                      {branch.evidenceChannelCount}
                                    </strong>
                                  </span>
                                  <span>
                                    Small known:{" "}
                                    <strong>
                                      {branch.smallKnownChannelCount}
                                    </strong>
                                  </span>
                                  <span>
                                    Median/day:{" "}
                                    <strong>
                                      {Math.round(
                                        branch.medianViewsPerDay,
                                      ).toLocaleString()}
                                    </strong>
                                  </span>
                                  <span>
                                    Best/day:{" "}
                                    <strong>
                                      {Math.round(
                                        branch.bestViewsPerDay,
                                      ).toLocaleString()}
                                    </strong>
                                  </span>
                                  <span>
                                    Score:{" "}
                                    <strong>
                                      {(branch.branchScore * 100).toFixed(0)}%
                                    </strong>
                                  </span>
                                </div>
                                {branch.suggestedQueries.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium text-muted-foreground">
                                        Suggested queries
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => {
                                          navigator.clipboard.writeText(
                                            branch.suggestedQueries.join("\n"),
                                          );
                                        }}
                                      >
                                        Copy queries
                                      </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {branch.suggestedQueries.map((q, i) => (
                                        <span
                                          key={i}
                                          className="rounded-md border bg-card px-2 py-0.5 text-xs font-mono"
                                        >
                                          {q}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {branch.exampleVideos.length > 0 && (
                                  <div>
                                    <span className="text-xs font-medium text-muted-foreground">
                                      Example videos
                                    </span>
                                    <ul className="mt-1 space-y-1">
                                      {branch.exampleVideos.map((ev, i) => (
                                        <li key={i} className="text-xs">
                                          {ev.url ? (
                                            <a
                                              href={ev.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="hover:underline"
                                            >
                                              {ev.title}
                                            </a>
                                          ) : (
                                            ev.title
                                          )}
                                          <span className="text-muted-foreground">
                                            {" "}
                                            · {ev.channelTitle} ·{" "}
                                            {Math.round(
                                              ev.viewsPerDay,
                                            ).toLocaleString()}
                                            /day
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              <div>
                <h3 className="mb-2 text-base font-semibold">
                  Rising Small Channels
                </h3>
                {opportunityQuery.data.risingSmallChannels.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Channel</TableHead>
                          <TableHead>Subs</TableHead>
                          <TableHead>Matched</TableHead>
                          <TableHead>Median / day</TableHead>
                          <TableHead>Best / day</TableHead>
                          <TableHead>Queries</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Top evidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {opportunityQuery.data.risingSmallChannels.map((ch) => (
                          <TableRow key={ch.channelId}>
                            <TableCell className="font-medium">
                              {ch.channelTitle ?? "—"}
                            </TableCell>
                            <TableCell>
                              <span
                                title={
                                  ch.subscriberCount === null
                                    ? "Subscriber count unavailable from API"
                                    : undefined
                                }
                              >
                                {formatSubs(ch.subscriberCount)}
                              </span>
                            </TableCell>
                            <TableCell>{ch.matchedVideoCount}</TableCell>
                            <TableCell>
                              {formatNumber(Math.round(ch.medianViewsPerDay))}
                            </TableCell>
                            <TableCell>
                              {formatNumber(Math.round(ch.bestViewsPerDay))}
                            </TableCell>
                            <TableCell>{ch.queryCoverage}</TableCell>
                            <TableCell>
                              {ch.relevanceScore.toFixed(3)}
                            </TableCell>
                            <TableCell className="max-w-64 truncate">
                              {ch.topEvidenceVideoTitle ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No known small channels found.{" "}
                    {(opportunityQuery.data.signals.find(
                      (s) => s.label === "Unknown Subscriber Channels",
                    )?.value ?? 0 > 0)
                      ? `${opportunityQuery.data.signals.find((s) => s.label === "Unknown Subscriber Channels")?.value} channels have unknown subscriber counts.`
                      : ""}
                  </p>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-base font-semibold">Outlier Videos</h3>
                {opportunityQuery.data.outlierVideos.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Video</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead>Subs</TableHead>
                          <TableHead>Views</TableHead>
                          <TableHead>Views / day</TableHead>
                          <TableHead>Published</TableHead>
                          <TableHead>Query</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {opportunityQuery.data.outlierVideos.map((v) => (
                          <TableRow key={v.videoId}>
                            <TableCell className="max-w-64 truncate font-medium">
                              {v.title}
                            </TableCell>
                            <TableCell>{v.channelTitle ?? "—"}</TableCell>
                            <TableCell>
                              <span
                                title={
                                  v.subscriberCount === null
                                    ? "Subscriber count unavailable from API"
                                    : undefined
                                }
                              >
                                {formatSubs(v.subscriberCount)}
                              </span>
                            </TableCell>
                            <TableCell>{formatNumber(v.viewCount)}</TableCell>
                            <TableCell>
                              {formatNumber(Math.round(v.viewsPerDay))}
                            </TableCell>
                            <TableCell>{formatDate(v.publishedAt)}</TableCell>
                            <TableCell>{v.query}</TableCell>
                            <TableCell>{v.outlierScore.toFixed(2)}</TableCell>
                            <TableCell>
                              {v.confidence === "high" ? (
                                <Badge variant="default">high</Badge>
                              ) : v.confidence === "medium" ? (
                                <Badge variant="secondary">medium</Badge>
                              ) : (
                                <Badge variant="outline">low</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No outlier videos found.
                  </p>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-base font-semibold">
                  Query Performance
                </h3>
                {opportunityQuery.data.queryPerformance.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Query</TableHead>
                          <TableHead>Videos</TableHead>
                          <TableHead>Channels</TableHead>
                          <TableHead>Small</TableHead>
                          <TableHead>Median / day</TableHead>
                          <TableHead>Best / day</TableHead>
                          <TableHead>Outliers</TableHead>
                          <TableHead>Quality</TableHead>
                          <TableHead>Cohesion</TableHead>
                          <TableHead>Branch</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {opportunityQuery.data.queryPerformance.map((qp) => (
                          <TableRow key={qp.query}>
                            <TableCell
                              className="max-w-36 truncate font-medium"
                              title={qp.genericQueryWarning ?? qp.query}
                            >
                              {qp.query}
                              {qp.genericQueryWarning && (
                                <span
                                  className="ml-1.5 inline-block rounded-full bg-amber-100 px-1.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  title={qp.genericQueryWarning}
                                >
                                  ⚠
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{qp.totalDiscoveredVideos}</TableCell>
                            <TableCell>{qp.uniqueChannels}</TableCell>
                            <TableCell>{qp.smallChannelsCount}</TableCell>
                            <TableCell>
                              {formatNumber(Math.round(qp.medianViewsPerDay))}
                            </TableCell>
                            <TableCell>
                              {formatNumber(Math.round(qp.bestViewsPerDay))}
                            </TableCell>
                            <TableCell>{qp.outlierCount}</TableCell>
                            <TableCell>
                              {qp.queryQualityScore.toFixed(4)}
                            </TableCell>
                            <TableCell>
                              {qp.cohesionContribution !== undefined
                                ? (qp.cohesionContribution * 100).toFixed(0) +
                                  "%"
                                : "—"}
                            </TableCell>
                            <TableCell className="max-w-32 text-xs">
                              {qp.branchMatches &&
                              qp.branchMatches.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {qp.branchMatches.map((bm, i) => (
                                    <span
                                      key={i}
                                      className="rounded bg-muted px-1 py-0.5"
                                    >
                                      {bm}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No query data available.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
      <Tabs defaultValue="candidates">
        <TabsList>
          <TabsTrigger value="candidates">Research Candidates</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>
        <TabsContent value="candidates">
          <Card>
            <CardHeader>
              <CardTitle>Research Candidates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {candidatesQuery.data?.map((candidate) => (
                <Card key={candidate.id} className="cursor-pointer" onClick={() => setCuratingCandidate(candidate)}>
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle>{candidate.format_name}</CardTitle>
                      <Badge>{candidate.confidence_score}% confidence</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{candidate.videoCount} videos · {candidate.channelCount} channels · {formatNumber(Math.round(candidate.medianViewsPerDay))} median views/day</p>
                    <p className="text-sm">Why this format works: {candidate.format_summary}</p>
                    <div className="grid gap-2 text-sm sm:grid-cols-2"><p><span className="font-medium">Common hooks:</span> {candidate.common_hooks.join(" · ") || "Unavailable"}</p><p><span className="font-medium">Common title patterns:</span> {candidate.common_title_patterns.join(" · ") || "Unavailable"}</p><p><span className="font-medium">Common emotions:</span> {candidate.common_emotions.join(" · ") || "Unavailable"}</p><p><span className="font-medium">Typical duration:</span> {candidate.typical_duration_range}</p></div>
                    <p className="text-sm"><span className="font-medium">Visual style estimate:</span> {candidate.likely_visual_style}</p>
                    <div className="grid gap-2 text-sm sm:grid-cols-2"><p><span className="font-medium">Example videos:</span> {candidate.example_videos.join(" · ") || "Unavailable"}</p><p><span className="font-medium">Example channels:</span> {candidate.example_channels.join(" · ") || "Unavailable"}</p></div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); setCuratingCandidate(candidate); }}>Curate videos</Button>
                      <Button type="button" variant="outline" size="sm" onClick={async (event) => { event.stopPropagation(); await navigator.clipboard.writeText(candidate.suggestedQueries.join("\n")); setCopiedCandidateId(candidate.id); }}><Clipboard className="mr-1 h-3 w-3" />{copiedCandidateId === candidate.id ? "Copied" : "Copy queries"}</Button>
                      <Button type="button" variant="outline" size="sm" disabled={exportingCandidateId === candidate.id} onClick={async (event) => { event.stopPropagation(); setExportingCandidateId(candidate.id); try { await downloadResearchCandidateCsv(params.runId, candidate.id); } finally { setExportingCandidateId(null); } }}><Download className="mr-1 h-3 w-3" />{exportingCandidateId === candidate.id ? "Exporting..." : "Export CSV"}</Button>
                      <Button type="button" variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); setResearchPlaceholderId(candidate.id); }}>{candidate.export_to_research.label}</Button>
                    </div>
                    {researchPlaceholderId === candidate.id && <p className="text-xs text-muted-foreground">Placeholder only; nothing is sent to shorts-research.</p>}
                  </CardHeader>
                  <CardContent>
                <details className="rounded-md border p-4">
                  <summary className="cursor-pointer font-medium">Debug</summary>
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold capitalize">
                          {candidate.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {candidate.summary}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {candidate.contentFormat} · {candidate.audience}
                        </p>
                      </div>
                      <Badge>
                        Score{" "}
                        {Math.round(candidate.adjustedResearchScore * 100)}
                      </Badge>
                      <Badge variant="outline">
                        Raw {Math.round(candidate.researchScore * 100)}
                      </Badge>
                      <Badge variant="outline">
                        {candidate.dominantLanguage.toUpperCase()}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={exportingCandidateId === candidate.id}
                        onClick={async (event) => {
                          event.preventDefault();
                          setExportingCandidateId(candidate.id);
                          try {
                            await downloadResearchCandidateCsv(
                              params.runId,
                              candidate.id,
                            );
                          } catch (error) {
                            console.error("Failed to export candidate CSV:", error);
                          } finally {
                            setExportingCandidateId(null);
                          }
                        }}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        {exportingCandidateId === candidate.id
                          ? "Exporting..."
                          : "Export CSV"}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p>
                        {candidate.videoCount} videos · {candidate.channelCount}{" "}
                        channels · {candidate.smallChannelCount} small channels
                      </p>
                      <p className="mt-1">
                        Median velocity:{" "}
                        {formatNumber(Math.round(candidate.medianViewsPerDay))}{" "}
                        views/day
                      </p>
                      <p className="mt-3 text-muted-foreground">{candidate.whyResearchable}</p>
                      <p className="mt-2 text-muted-foreground">
                        Shorts evidence: {Math.round(candidate.shorts_evidence_ratio * 100)}% · Language script: {Math.round(candidate.language_script_score * 100)}%
                      </p>
                      {candidate.why_boosted.length > 0 && <p className="mt-2 text-emerald-700 dark:text-emerald-400">Boosted: {candidate.why_boosted.join(" · ")}</p>}
                      {candidate.why_penalized.length > 0 && <p className="mt-2 text-amber-700 dark:text-amber-400">Penalized: {candidate.why_penalized.join(" · ")}</p>}
                      {candidate.suggestedQueries.length > 0 && (
                        <p className="mt-2 text-muted-foreground">Suggested queries: {candidate.suggestedQueries.join(" · ")}</p>
                      )}
                      <p className="mt-3 font-medium">
                        Representative channels
                      </p>
                      <ul className="mt-1 space-y-1 text-muted-foreground">
                        {candidate.representativeChannels.map((channel) => (
                          <li key={channel.channelId}>
                            {channel.title ?? channel.channelId}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium">Representative videos</p>
                      <ul className="mt-1 space-y-2">
                        {candidate.representativeVideos.map((video, index) => (
                          <li key={`${video.youtubeId}-${index}`}>
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
                            <p className="text-xs text-muted-foreground">
                              {video.channelTitle ?? "Unknown channel"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>
                  </CardContent>
                </Card>
              ))}
              {!candidatesQuery.isLoading && !candidatesQuery.data?.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No research candidates yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="videos">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><CardTitle>Discovered videos</CardTitle><p className="mt-1 text-sm text-muted-foreground">Select up to 250 videos from this Discovery run for manual Content Format curation.</p></div>
                {selectedVideoIds.size > 0 && <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2" aria-live="polite"><span className="text-sm font-medium">{selectedVideoIds.size} videos selected</span><Button type="button" size="sm" variant="ghost" onClick={() => setSelectedVideoIds(new Set())}>Clear</Button><Button type="button" size="sm" onClick={() => setContentFormatDialogOpen(true)}>Add to Content Format</Button></div>}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"><Checkbox aria-label="Select all videos on this page" checked={allVideosOnPageSelected} onCheckedChange={(checked) => togglePageVideos(checked === true)} disabled={!videos.length || (selectedVideoIds.size >= 250 && !allVideosOnPageSelected)} /></TableHead>
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
                  {videos.map((video) => (
                    <TableRow
                      key={`${video.videoId}-${video.query}-${video.searchOrder}`}
                      data-state={selectedVideoIds.has(video.videoId) ? "selected" : undefined}
                    >
                      <TableCell><Checkbox aria-label={`Select ${video.title}`} checked={selectedVideoIds.has(video.videoId)} disabled={!selectedVideoIds.has(video.videoId) && selectedVideoIds.size >= 250} onCheckedChange={(checked) => toggleVideo(video.videoId, checked === true)} /></TableCell>
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
              {!videosQuery.isLoading && !videos.length && (
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
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["maxAge", "Max age (months)"],
                ["minMatched", "Min matched videos"],
                ["minSubs", "Min subscribers"],
                ["maxSubs", "Max subscribers"],
                ["minMedian", "Min median views"],
                ["minScore", "Min score (0-1)"],
                ["minCoverage", "Min query coverage"],
                ["minMedianPerDay", "Min median views/day"],
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
                      label="Score"
                      column="relevanceScore"
                      onSort={changeSort}
                    />
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
                      label="Queries"
                      column="queryCoverage"
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
                      label="Median/day"
                      column="medianViewsPerDay"
                      onSort={changeSort}
                    />
                    <SortHead
                      label="Best/day"
                      column="bestViewsPerDay"
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
                      <TableCell className="min-w-40 align-top">
                        <details>
                          <summary className="cursor-pointer font-semibold">
                            {channel.relevanceScore.toFixed(3)}
                          </summary>
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <div>
                              Matched:{" "}
                              {Math.min(
                                channel.matchedVideoCount / 10,
                                1,
                              ).toFixed(2)}{" "}
                              × 30%
                            </div>
                            <div>
                              Coverage:{" "}
                              {Math.min(channel.queryCoverage / 3, 1).toFixed(
                                2,
                              )}{" "}
                              × 20%
                            </div>
                            <div>
                              Velocity:{" "}
                              {Math.min(
                                channel.medianViewsPerDay / 10_000,
                                1,
                              ).toFixed(2)}{" "}
                              × 25%
                            </div>
                            <div>
                              Recency: {channel.recencyScore.toFixed(2)} × 15%
                            </div>
                            <div>
                              Views/sub:{" "}
                              {channel.viewsPerSubscriberScore.toFixed(2)} × 10%
                            </div>
                          </div>
                        </details>
                      </TableCell>
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
                        <span
                          title={
                            channel.subscriberCount === null
                              ? "Subscriber count unavailable from API"
                              : undefined
                          }
                        >
                          {formatSubs(channel.subscriberCount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatNumber(channel.totalViewCount)}
                      </TableCell>
                      <TableCell>{channel.matchedVideoCount}</TableCell>
                      <TableCell>{channel.queryCoverage}</TableCell>
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
                        {formatNumber(Math.round(channel.medianViewsPerDay))}
                      </TableCell>
                      <TableCell>
                        {formatNumber(Math.round(channel.bestViewsPerDay))}
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
      <FormatCurationDialog runId={params.runId} candidate={curatingCandidate} open={Boolean(curatingCandidate)} onOpenChange={(open) => { if (!open) setCuratingCandidate(null); }} />
      <AddToContentFormatDialog
        open={contentFormatDialogOpen}
        onOpenChange={setContentFormatDialogOpen}
        runId={params.runId}
        selectedVideoIds={selectedVideoIds}
        onAttached={() => setSelectedVideoIds(new Set())}
      />
    </div>
  );
}
