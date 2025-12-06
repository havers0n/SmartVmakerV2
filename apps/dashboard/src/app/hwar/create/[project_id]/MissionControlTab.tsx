import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useToast } from "@/shared/hooks/use-toast";
import { useAnimationOverview } from "@/hooks/useAnimationOverview";
import { AnimationJobDto } from "@scrimspec/hwar-core/types/generation";
import { ExternalLink, RefreshCcw, RotateCcw } from "lucide-react";

type Props = {
  projectId: string;
};

const statusColors: Record<AnimationJobDto["status"] | "idle", string> = {
  idle: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-800",
  running: "bg-blue-100 text-blue-800",
  succeeded: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

function formatStatus(status: AnimationJobDto["status"] | "idle") {
  return status;
}

function truncateTaskId(id: string | null) {
  if (!id) return "-";
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function MissionControlTab({ projectId }: Props) {
  const { toast } = useToast();
  const { overview, isLoading, error, refresh } = useAnimationOverview(projectId);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const jobs = overview?.jobs ?? [];
  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  const stats = useMemo(() => {
    const total = jobs.length;
    const succeeded = jobs.filter((j) => j.status === "succeeded").length;
    const running = jobs.filter((j) => j.status === "running" || j.status === "pending").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    return { total, succeeded, running, failed };
  }, [jobs]);

  const hasFailed = jobs.some((j) => j.status === "failed");

  const handleRetry = async (job: AnimationJobDto) => {
    if (retryingJobId) return;
    setRetryingJobId(job.id);
    try {
      const res = await fetch(
        `/api/generation/projects/${projectId}/animation/${job.id}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Retry failed");
      }
      toast({
        title: "Retry scheduled",
        description: "Job moved to pending.",
      });
      refresh();
    } catch (err: any) {
      toast({
        title: "Retry error",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRetryingJobId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="mt-8 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-8 p-6 space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Failed to load animation overview</AlertTitle>
          <AlertDescription className="space-y-2">
            <div>{error instanceof Error ? error.message : "Unknown error"}</div>
            <Button size="sm" variant="outline" onClick={() => refresh()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Mission Control</h2>
          <p className="text-sm text-muted-foreground">
            Monitor all animation jobs and retry failed tasks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={cn("capitalize", statusColors[overview?.overallStatus ?? "idle"])}>
            {formatStatus(overview?.overallStatus ?? "idle")}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total jobs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Succeeded</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-600">
            {stats.succeeded}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Running</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-blue-600">
            {stats.running}
          </CardContent>
        </Card>
        <Card className={stats.failed > 0 ? "border-red-300" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-red-600">
            {stats.failed}
          </CardContent>
        </Card>
      </div>

      {hasFailed && (
        <Alert variant="destructive">
          <AlertTitle>Some jobs failed. Select a row to inspect error.</AlertTitle>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scene</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Task ID</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const isSelected = selectedJobId === job.id;
                  return (
                    <TableRow
                      key={job.id}
                      className={cn("cursor-pointer", isSelected && "bg-muted/50")}
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      <TableCell>
                        {job.sceneIndex !== null ? `Scene ${job.sceneIndex + 1}` : "Global"}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("capitalize", statusColors[job.status])}>
                          {formatStatus(job.status)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="font-mono text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!job.minimaxTaskId) return;
                          navigator.clipboard?.writeText(job.minimaxTaskId);
                          toast({ title: "Copied", description: "Task ID copied to clipboard" });
                        }}
                      >
                        {truncateTaskId(job.minimaxTaskId)}
                      </TableCell>
                      <TableCell>{job.durationSeconds ? `${job.durationSeconds}s` : "-"}</TableCell>
                      <TableCell>{formatDate(job.lastSyncAt)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {job.videoUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a href={job.videoUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Open video
                            </a>
                          </Button>
                        ) : null}
                        {job.status === "failed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(job);
                            }}
                            disabled={retryingJobId === job.id}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            {retryingJobId === job.id ? "Retrying..." : "Retry"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Error inspector</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32">Status</span>
              <span>{selectedJob.status}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32">Task ID</span>
              <span className="font-mono break-all">{selectedJob.minimaxTaskId ?? "-"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32">Error code</span>
              <span>{selectedJob.errorCode ?? "-"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32">Error message</span>
              <span>{selectedJob.errorMessage ?? "-"}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

