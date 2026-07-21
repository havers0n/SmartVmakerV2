"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Textarea } from "@/shared/components/ui/textarea";
import { apiRequest } from "@/shared/lib/api";

const api = <T,>(url: string, init?: RequestInit) =>
  apiRequest(url, init) as Promise<T>;

type SourceType = "youtube_video" | "youtube_channel" | "manual";
type SeedSource = {
  id: string;
  type: SourceType;
  url: string | null;
  title: string;
  notes: string | null;
  status: "new" | "processed";
  createdAt: string;
};
const labels: Record<SourceType, string> = {
  youtube_video: "YouTube Video",
  youtube_channel: "YouTube Channel",
  manual: "Manual Note",
};

export default function SourcesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SourceType>("youtube_video");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const sources = useQuery<SeedSource[]>({
    queryKey: ["seed-sources"],
    queryFn: () => api<SeedSource[]>("/api/seed-sources"),
  });
  const create = useMutation({
    mutationFn: (value: object) =>
      api<SeedSource>("/api/seed-sources", {
        method: "POST",
        body: JSON.stringify(value),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seed-sources"] });
      setOpen(false);
      setUrl("");
      setTitle("");
      setNotes("");
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const sourceTitle =
      title.trim() || (type === "youtube_video" ? url.trim() : "");
    create.mutate({
      type,
      url: type === "manual" ? null : url,
      title: sourceTitle,
      notes: notes || null,
    });
  }
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <BookOpen className="h-6 w-6 text-primary" /> Idea Sources
          </h1>
          <p className="mt-2 text-muted-foreground">
            Save source material and manually extract niche candidates.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add source</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={submit}>
              <RadioGroup
                value={type}
                onValueChange={(value) => setType(value as SourceType)}
                className="space-y-2"
              >
                {(Object.keys(labels) as SourceType[]).map((value) => (
                  <div key={value} className="flex items-center gap-2">
                    <RadioGroupItem id={value} value={value} />
                    <Label htmlFor={value}>{labels[value]}</Label>
                  </div>
                ))}
              </RadioGroup>
              {type !== "manual" && (
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title{type === "youtube_video" ? " (optional override)" : ""}
                </Label>
                <Input
                  id="title"
                  required={type !== "youtube_video"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              {create.error && (
                <p className="text-sm text-destructive">
                  {create.error.message}
                </p>
              )}
              <Button className="w-full" disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Save source"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {sources.error && (
        <p className="text-sm text-destructive">{sources.error.message}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sources.data?.map((source) => (
          <Link href={`/discovery/sources/${source.id}`} key={source.id}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <CardDescription>
                  {labels[source.type]} · {source.status}
                </CardDescription>
                <CardTitle className="line-clamp-2">{source.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {source.notes || source.url || "No notes"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {!sources.isLoading && sources.data?.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No sources yet.
        </p>
      )}
    </div>
  );
}
