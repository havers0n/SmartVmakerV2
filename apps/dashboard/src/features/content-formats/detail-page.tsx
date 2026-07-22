"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { contentFormatsApi, contentFormatKeys, type Detail } from "./api";
import { ContentFormatForm } from "./content-format-form";
function Confirm({
  label,
  description,
  onConfirm,
  disabled,
  variant,
}: {
  label: string;
  description: string;
  onConfirm: () => void;
  disabled?: boolean;
  variant?: "destructive";
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} variant={variant}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label} content format?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
            onClick={onConfirm}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
function Associations({
  detail,
  kind,
  mutate,
}: {
  detail: Detail;
  kind: "videos" | "channels";
  mutate: (path: string, body?: unknown) => void;
}) {
  const archived = detail.format.status === "archived";
  const rows = detail[kind] as any[];
  return (
    <div className="space-y-3">
      {rows.length ? (
        rows.map((row) => {
          const a = row.association;
          const item = kind === "videos" ? row.video : row.channel;
          const id = kind === "videos" ? a.videoId : a.channelId;
          return (
            <Card key={id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {item.title || item.name || item.youtubeId || "Untitled"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {kind === "videos" && (item.channelTitle || item.youtubeId)}{" "}
                    · {a.source} · confidence {a.confidence ?? "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {a.note || "No note"}
                  </p>
                </div>
                {!archived && (
                  <div className="flex gap-2">
                    <select
                      aria-label={`${kind} role`}
                      className="h-9 rounded border bg-background px-2"
                      defaultValue={a.role}
                      onChange={(e) =>
                        mutate(`${kind}/${id}`, { role: e.target.value })
                      }
                    >
                      <option
                        value={kind === "videos" ? "exemplar" : "primary"}
                      >
                        {kind === "videos" ? "exemplar" : "primary"}
                      </option>
                      <option
                        value={kind === "videos" ? "supporting" : "frequent"}
                      >
                        {kind === "videos" ? "supporting" : "frequent"}
                      </option>
                      <option
                        value={
                          kind === "videos" ? "counterexample" : "reference"
                        }
                      >
                        {kind === "videos" ? "counterexample" : "reference"}
                      </option>
                    </select>
                    <Button
                      variant="destructive"
                      onClick={() => mutate(`${kind}/${id}`)}
                    >
                      Detach
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {kind === "videos"
            ? "Videos can be added from Discovery."
            : "No channels are associated with this format."}
        </div>
      )}
    </div>
  );
}
function Evidence({
  detail,
  mutate,
}: {
  detail: Detail;
  mutate: (path: string, body?: unknown) => void;
}) {
  const [statement, setStatement] = useState("");
  const [type, setType] = useState("hook");
  const archived = detail.format.status === "archived";
  return (
    <div className="space-y-4">
      {!archived && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="font-medium">Add evidence</h3>
            <Label htmlFor="evidence-statement">Statement</Label>
            <Textarea
              id="evidence-statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />
            <select
              aria-label="Evidence type"
              className="h-10 rounded border bg-background px-3"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="hook">Hook</option>
              <option value="structure">Structure</option>
              <option value="visual_style">Visual style</option>
              <option value="pacing">Pacing</option>
              <option value="other">Other</option>
            </select>
            <Button
              disabled={
                !statement.trim() ||
                (!detail.videos.length && !detail.channels.length)
              }
              onClick={() => {
                const linked = detail.videos[0]?.association?.videoId
                  ? { videoId: detail.videos[0].association.videoId }
                  : { channelId: detail.channels[0]?.association?.channelId };
                mutate("evidence", {
                  evidenceType: type,
                  statement,
                  ...linked,
                });
                setStatement("");
              }}
            >
              Add evidence
            </Button>
          </CardContent>
        </Card>
      )}
      {detail.evidence.length ? (
        detail.evidence.map((row: any) => (
          <Card key={row.evidence.id}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{row.evidence.evidenceType}</p>
                <p>{row.evidence.statement}</p>
                <p className="text-sm text-muted-foreground">
                  {row.evidence.source} · confidence{" "}
                  {row.evidence.confidence ?? "—"}
                </p>
              </div>
              {!archived && (
                <Button
                  variant="destructive"
                  onClick={() => mutate(`evidence/${row.evidence.id}`)}
                >
                  Delete
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No evidence yet.
        </div>
      )}
    </div>
  );
}
export function ContentFormatDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id;
  const query = useQuery({
    queryKey: contentFormatKeys.detail(id),
    queryFn: () => contentFormatsApi.detail(id),
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: contentFormatKeys.detail(id) });
    qc.invalidateQueries({ queryKey: ["content-formats"] });
  };
  const action = useMutation({
    mutationFn: async ({
      kind,
      path,
      body,
    }: {
      kind?: "activate" | "archive" | "restore";
      path?: string;
      body?: unknown;
    }) => {
      if (kind) return contentFormatsApi[kind](id);
      if (path === "format") return contentFormatsApi.update(id, body as any);
      if (path === "evidence")
        return contentFormatsApi.createEvidence(id, body);
      const [resource, itemId] = path!.split("/");
      if (resource === "evidence")
        return contentFormatsApi.deleteEvidence(id, itemId);
      const update =
        resource === "videos"
          ? contentFormatsApi.updateVideo
          : contentFormatsApi.updateChannel;
      const remove =
        resource === "videos"
          ? contentFormatsApi.deleteVideo
          : contentFormatsApi.deleteChannel;
      return body ? update(id, itemId, body) : remove(id, itemId);
    },
    onSuccess: invalidate,
  });
  if (query.isLoading)
    return <div className="h-96 animate-pulse rounded-lg bg-muted" />;
  if (query.isError || !query.data)
    return (
      <div className="p-8">
        Could not load this content format.{" "}
        <Button onClick={() => query.refetch()}>Retry</Button>
      </div>
    );
  const d = query.data;
  const archived = d.format.status === "archived";
  const transition = (kind: "activate" | "archive" | "restore") =>
    action.mutate({ kind });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{d.format.name}</h1>
            <Badge>{d.format.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.format.formatType} · {d.format.slug}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {d.counts.videoCount} videos · {d.counts.channelCount} channels ·{" "}
            {d.counts.evidenceCount} evidence
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.format.status === "draft" && (
            <Confirm
              label="Activate"
              disabled={!d.counts.videoCount}
              description="This draft will become active and available for future projects."
              onConfirm={() => transition("activate")}
            />
          )}{" "}
          {d.format.status === "draft" && !d.counts.videoCount && (
            <p className="w-full text-xs text-muted-foreground">
              Add at least one video before activating this format.
            </p>
          )}
          {d.format.status === "active" && (
            <Confirm
              label="Archive"
              variant="destructive"
              description="Archived formats become read-only until restored."
              onConfirm={() => transition("archive")}
            />
          )}{" "}
          {archived && (
            <Confirm
              label="Restore"
              description="This archived format will return to draft status."
              onConfirm={() => transition("restore")}
            />
          )}
          <Button
            variant="outline"
            onClick={() => router.push("/content-formats")}
          >
            Back
          </Button>
        </div>
      </header>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-5">
          {d.format.status === "active" && (
            <p className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              Changes apply only to future projects. Existing projects keep
              their saved snapshot.
            </p>
          )}
          <ContentFormatForm
            initial={d.format}
            disabled={archived}
            submitLabel="Save changes"
            saving={action.isPending}
            onSubmit={(body) => action.mutate({ path: "format", body })}
          />
        </TabsContent>
        <TabsContent value="videos" className="pt-5">
          <Associations
            detail={d}
            kind="videos"
            mutate={(path, body) => action.mutate({ path, body })}
          />
        </TabsContent>
        <TabsContent value="channels" className="pt-5">
          <Associations
            detail={d}
            kind="channels"
            mutate={(path, body) => action.mutate({ path, body })}
          />
        </TabsContent>
        <TabsContent value="evidence" className="pt-5">
          <Evidence
            detail={d}
            mutate={(path, body) => action.mutate({ path, body })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
