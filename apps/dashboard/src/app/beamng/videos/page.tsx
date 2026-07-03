"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Search, TrendingUp, Video } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

interface Pattern {
  id: string;
  label: string;
}
interface BeamngVideo {
  id: string;
  title: string;
  url: string;
  channelTitle: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  durationBucket: string;
  viewCount: number | null;
  patterns: Pattern[];
  outlierScore: number | null;
  outlierConfidence: "low" | "normal";
  metrics: { viewsPerDay: number | null };
}
interface PatternAggregate {
  patternId: string;
  label: string;
  videoCount: number;
  channelCount: number;
  averageViewsPerDay: number | null;
  medianViewsPerDay: number | null;
  topVideo: { title: string; url: string } | null;
  topChannel: { title: string | null; handle: string | null } | null;
}

const patternOptions: Pattern[] = [
  ["big_small", "Big & Small"],
  ["cars_vs", "Cars vs"],
  ["train", "Train"],
  ["tornado", "Tornado"],
  ["high_speed", "High-Speed"],
  ["realistic", "Realistic"],
  ["survival", "Survival"],
  ["family_crash_test", "Family Crash Test"],
  ["flatbed_transport", "Flatbed / Transportation"],
  ["damage_cost", "Damage Cost"],
  ["police", "Police"],
  ["logs", "Logs"],
  ["stairs", "Stairs"],
  ["unfinished_road", "Unfinished Road"],
  ["speedbumps", "Speedbumps"],
  ["mcqueen", "McQueen"],
  ["spiderman", "Spider-Man"],
  ["monster_truck", "Monster Truck"],
].map(([id, label]) => ({ id, label }));
const bucketLabels: Record<string, string> = {
  shorts: "Shorts",
  "1_5m": "1–5 min",
  "5_10m": "5–10 min",
  "10m_plus": "10+ min",
  unknown: "Unknown",
};
const number = (value: number | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en", {
        notation: value >= 1000 ? "compact" : "standard",
        maximumFractionDigits: 1,
      }).format(value);

export default function BeamngVideosPage() {
  const [videos, setVideos] = useState<BeamngVideo[]>([]);
  const [patterns, setPatterns] = useState<PatternAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("viewsPerDay");
  const [sortDir, setSortDir] = useState("desc");
  const [pattern, setPattern] = useState("all");
  const [durationBucket, setDurationBucket] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500", sortBy, sortDir });
      if (search) params.set("search", search);
      if (pattern !== "all") params.set("pattern", pattern);
      if (durationBucket !== "all")
        params.set("durationBucket", durationBucket);
      const patternParams = new URLSearchParams();
      if (durationBucket !== "all")
        patternParams.set("durationBucket", durationBucket);
      const [videoResponse, patternResponse] = await Promise.all([
        fetch(`/api/beamng/videos?${params}`),
        fetch(`/api/beamng/patterns?${patternParams}`),
      ]);
      if (!videoResponse.ok || !patternResponse.ok)
        throw new Error("Failed to load discovery data");
      const [videoData, patternData] = await Promise.all([
        videoResponse.json(),
        patternResponse.json(),
      ]);
      setVideos(videoData.videos ?? []);
      setPatterns(patternData.patterns ?? []);
    } catch (error) {
      console.error(error);
      setVideos([]);
      setPatterns([]);
    } finally {
      setLoading(false);
    }
  }, [durationBucket, pattern, search, sortBy, sortDir]);
  useEffect(() => {
    load();
  }, [load]);
  const reset = () => {
    setSearch("");
    setSortBy("viewsPerDay");
    setSortDir("desc");
    setPattern("all");
    setDurationBucket("all");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          BeamNG Discovery
        </h1>
        <p className="text-muted-foreground mt-1">
          Find repeatable formats and channel-relative outliers.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search titles"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewsPerDay">Views/day</SelectItem>
            <SelectItem value="outlierScore">Outlier score</SelectItem>
            <SelectItem value="publishedAt">Published</SelectItem>
            <SelectItem value="views">Views</SelectItem>
          </SelectContent>
        </Select>
        <Select value={pattern} onValueChange={setPattern}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Pattern" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All patterns</SelectItem>
            {patternOptions.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={durationBucket} onValueChange={setDurationBucket}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All durations</SelectItem>
            {Object.entries(bucketLabels).map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() =>
            setSortDir((value) => (value === "desc" ? "asc" : "desc"))
          }
        >
          {sortDir === "desc" ? "↓" : "↑"}
        </Button>
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No matching videos
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Video</TableHead>
                  <TableHead>Patterns</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Views/day</TableHead>
                  <TableHead className="text-right">Outlier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell className="max-w-md">
                      <a
                        className="font-medium hover:text-primary line-clamp-2"
                        href={video.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {video.title}
                      </a>
                      <span className="text-xs text-muted-foreground">
                        {video.channelTitle ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {video.patterns.length ? (
                          video.patterns.map((item) => (
                            <Badge key={item.id} variant="secondary">
                              {item.label}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">Other</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {bucketLabels[video.durationBucket]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {number(video.viewCount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {number(video.metrics.viewsPerDay)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          video.outlierScore != null && video.outlierScore >= 2
                            ? "default"
                            : "outline"
                        }
                      >
                        {video.outlierScore == null
                          ? "—"
                          : `${video.outlierScore.toFixed(1)}×`}
                      </Badge>
                      {video.outlierConfidence === "low" && (
                        <div className="text-[10px] text-amber-500 mt-1">
                          low confidence
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Top Patterns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pattern</TableHead>
                <TableHead className="text-right">Videos</TableHead>
                <TableHead className="text-right">Channels</TableHead>
                <TableHead className="text-right">Avg views/day</TableHead>
                <TableHead className="text-right">Median views/day</TableHead>
                <TableHead>Top video</TableHead>
                <TableHead>Top channel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patterns.map((item) => (
                <TableRow key={item.patternId}>
                  <TableCell>
                    <Badge variant="secondary">{item.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.videoCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.channelCount}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {number(item.averageViewsPerDay)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {number(item.medianViewsPerDay)}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {item.topVideo ? (
                      <a
                        href={item.topVideo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-primary line-clamp-1"
                      >
                        {item.topVideo.title}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {item.topChannel?.title ?? item.topChannel?.handle ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
