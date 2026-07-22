"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { contentFormatKeys, contentFormatsApi, type Format, ContentFormatsApiError } from "@/features/content-formats/api";

type Role = "supporting" | "exemplar" | "counterexample";
type ListedFormat = { format: Format; videoCount: number; channelCount: number; evidenceCount: number };

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not attach selected videos.";
  if (error instanceof ContentFormatsApiError && error.status === 409 && message.includes("not part of"))
    return "One or more selected videos no longer belong to this Discovery run. Refresh the results and try again.";
  if (error instanceof ContentFormatsApiError && error.status === 400) return `Check the selected videos and fields: ${message}`;
  if (error instanceof ContentFormatsApiError && error.status === 404) return "The Content Format, Discovery run, or one of the selected videos could not be found.";
  if (error instanceof ContentFormatsApiError && error.status === 409) return message;
  return "Something went wrong. Please try again.";
}

export function AddToContentFormatDialog({
  open, onOpenChange, runId, selectedVideoIds, onAttached,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  selectedVideoIds: Set<string>;
  onAttached: () => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [role, setRole] = useState<Role>("supporting");
  const [name, setName] = useState("");
  const [formatType, setFormatType] = useState("short_form");
  const [description, setDescription] = useState("");
  const [createdFormat, setCreatedFormat] = useState<Format | null>(null);
  const [successFormat, setSuccessFormat] = useState<Format | null>(null);
  const ids = useMemo(() => [...selectedVideoIds], [selectedVideoIds]);
  const formats = useQuery<ListedFormat[]>({
    queryKey: contentFormatKeys.list({ picker: true }),
    queryFn: () => contentFormatsApi.list({ limit: 100 }),
    enabled: open,
    staleTime: 30_000,
  });
  const attach = useMutation({
    mutationFn: async (format: Format) => contentFormatsApi.bulkAttachVideos(format.id, { videoIds: ids, role, source: "discovery", discoveryRunId: runId }),
    onSuccess: (_result, format) => {
      queryClient.invalidateQueries({ queryKey: ["content-formats"] });
      queryClient.invalidateQueries({ queryKey: contentFormatKeys.detail(format.id) });
      setSuccessFormat(format);
      onAttached();
    },
  });
  const create = useMutation({
    mutationFn: () => contentFormatsApi.create({ name, formatType, description: description || undefined }),
    onSuccess: (format) => {
      setCreatedFormat(format);
      attach.mutate(format);
    },
  });
  const availableFormats = (formats.data ?? []).filter(({ format }) =>
    format.status !== "archived" && (!search || `${format.name} ${format.description ?? ""} ${format.formatType}`.toLowerCase().includes(search.toLowerCase())),
  );
  const pending = attach.isPending || create.isPending;
  const error = attach.error ?? create.error;
  const close = (value: boolean) => {
    if (!value) {
      setSuccessFormat(null);
      setCreatedFormat(null);
      setSearch("");
      setSelectedFormatId("");
      attach.reset();
      create.reset();
    }
    onOpenChange(value);
  };
  const roleControl = <div className="space-y-1"><Label htmlFor="content-format-role">Association role</Label><select id="content-format-role" className="h-10 w-full rounded-md border bg-background px-3" value={role} disabled={pending || Boolean(successFormat)} onChange={e => setRole(e.target.value as Role)}><option value="supporting">Supporting</option><option value="exemplar">Exemplar</option><option value="counterexample">Counterexample</option></select><p className="text-xs text-muted-foreground">Exemplar is a strong model; supporting confirms it; counterexample marks a boundary or exception.</p></div>;

  return <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Add {ids.length} videos to Content Format</DialogTitle><DialogDescription>Associations use Discovery&apos;s internal video IDs. Up to 250 videos can be attached at once.</DialogDescription></DialogHeader>
    {successFormat ? <div className="space-y-4"><p className="text-sm">Selected videos were added. Existing associations were preserved.</p><Button asChild><Link href={`/content-formats/${successFormat.id}`}>Open Content Format</Link></Button><Button variant="outline" onClick={() => close(false)}>Done</Button></div> : createdFormat && attach.isError ? <div className="space-y-4"><p className="text-sm text-destructive">The Content Format was created, but videos were not attached.</p><Button asChild variant="outline"><Link href={`/content-formats/${createdFormat.id}`}>Open created draft</Link></Button><Button disabled={attach.isPending} onClick={() => attach.mutate(createdFormat)}>Retry attaching videos</Button><p className="text-sm text-muted-foreground">{friendlyError(attach.error)}</p></div> : <>
      <div className="flex gap-2 border-b pb-3"><Button type="button" size="sm" variant={mode === "existing" ? "default" : "outline"} disabled={pending} onClick={() => setMode("existing")}>Existing Format</Button><Button type="button" size="sm" variant={mode === "new" ? "default" : "outline"} disabled={pending} onClick={() => setMode("new")}>New Format</Button></div>
      {mode === "existing" ? <div className="space-y-4"><div><Label htmlFor="format-search">Search formats</Label><Input id="format-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, type, or description" /></div>{formats.isLoading ? <p className="text-sm text-muted-foreground">Loading content formats…</p> : formats.isError ? <div><p className="text-sm text-destructive">Could not load content formats.</p><Button className="mt-2" size="sm" variant="outline" onClick={() => formats.refetch()}>Retry</Button></div> : !availableFormats.length ? <p className="text-sm text-muted-foreground">No draft or active Content Formats match.</p> : <div className="max-h-64 space-y-2 overflow-y-auto">{availableFormats.map(({ format, videoCount, evidenceCount }) => <label key={format.id} className="block cursor-pointer rounded-md border p-3 has-[:checked]:border-primary"><input className="mr-2" type="radio" name="format" checked={selectedFormatId === format.id} onChange={() => setSelectedFormatId(format.id)} /><span className="font-medium">{format.name}</span> <Badge className="ml-2" variant="outline">{format.status}</Badge><p className="mt-1 text-xs text-muted-foreground">{format.formatType} · {format.description || "No description"} · {videoCount} videos · {evidenceCount} evidence</p></label>)}</div>}{roleControl}<Button disabled={pending || !selectedFormatId} onClick={() => { const picked = availableFormats.find(item => item.format.id === selectedFormatId)?.format; if (picked) attach.mutate(picked); }}>{attach.isPending ? "Adding…" : "Add videos"}</Button></div> : <div className="space-y-4"><div><Label htmlFor="new-format-name">Name</Label><Input id="new-format-name" required value={name} onChange={e => setName(e.target.value)} /></div><div><Label htmlFor="new-format-type">Format type</Label><select id="new-format-type" className="h-10 w-full rounded-md border bg-background px-3" value={formatType} onChange={e => setFormatType(e.target.value)}><option value="short_form">Short form</option><option value="long_form">Long form</option><option value="mixed">Mixed</option></select></div><div><Label htmlFor="new-format-description">Description (optional)</Label><Input id="new-format-description" value={description} onChange={e => setDescription(e.target.value)} /></div>{roleControl}<Button disabled={pending || !name.trim()} onClick={() => create.mutate()}>{pending ? "Creating…" : "Create draft and add videos"}</Button></div>}
      {error && <p role="alert" className="text-sm text-destructive">{friendlyError(error)}</p>}
    </>}
  </DialogContent></Dialog>;
}
