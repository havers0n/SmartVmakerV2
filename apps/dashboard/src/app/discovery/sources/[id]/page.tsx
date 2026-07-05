"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Pencil, X } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Textarea } from "@/shared/components/ui/textarea";
import { apiRequest } from "@/shared/lib/api";

const api = <T,>(url: string, init?: RequestInit) =>
  apiRequest(url, init) as Promise<T>;

type Candidate = {
  id: string;
  name: string;
  description: string | null;
  status: "candidate" | "approved" | "rejected";
};
type Source = {
  id: string;
  type: string;
  url: string | null;
  title: string;
  notes: string | null;
  status: string;
  candidates: Candidate[];
};

export default function SourceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<string>();
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const source = useQuery<Source>({
    queryKey: ["seed-sources", params.id],
    queryFn: () => api<Source>(`/api/seed-sources/${params.id}`),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["seed-sources", params.id] });
    queryClient.invalidateQueries({ queryKey: ["seed-sources"] });
  };
  const add = useMutation({
    mutationFn: () =>
      api("/api/niche-candidates", {
        method: "POST",
        body: JSON.stringify({
          seedSourceId: params.id,
          name,
          description: description || null,
        }),
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      api(`/api/niche-candidates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setEditing(undefined);
      refresh();
    },
  });
  const approve = useMutation({
    mutationFn: (id: string) =>
      api(`/api/niche-candidates/${id}/approve`, { method: "POST" }),
    onSuccess: refresh,
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    add.mutate();
  }
  function beginEdit(candidate: Candidate) {
    setEditing(candidate.id);
    setEditName(candidate.name);
    setEditDescription(candidate.description ?? "");
  }
  if (source.isLoading)
    return <p className="text-muted-foreground">Loading…</p>;
  if (source.error)
    return (
      <div className="space-y-4">
        <Link href="/discovery/sources">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" /> Sources
          </Button>
        </Link>
        <p className="text-destructive">{source.error.message}</p>
      </div>
    );
  const data = source.data!;
  const error = add.error ?? update.error ?? approve.error;
  return (
    <div className="space-y-6">
      <Link href="/discovery/sources">
        <Button variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" /> Sources
        </Button>
      </Link>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{data.title}</CardTitle>
            <Badge variant="outline">{data.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            {data.type.replace(/_/g, " ")}
          </p>
          {data.url && (
            <a
              className="break-all text-primary hover:underline"
              href={data.url}
              target="_blank"
              rel="noreferrer"
            >
              {data.url}
            </a>
          )}
          {data.notes && <p className="whitespace-pre-wrap">{data.notes}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add candidate</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={submit}
            className="grid gap-3 md:grid-cols-[1fr_2fr_auto]"
          >
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button className="self-end" disabled={add.isPending}>
              Add
            </Button>
          </form>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Candidate Niches</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.candidates.map((candidate) => (
                <TableRow key={candidate.id}>
                  <TableCell>
                    {editing === candidate.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      candidate.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editing === candidate.id ? (
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    ) : (
                      candidate.description || "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{candidate.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {editing === candidate.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              update.mutate({
                                id: candidate.id,
                                body: {
                                  name: editName,
                                  description: editDescription || null,
                                },
                              })
                            }
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(undefined)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={candidate.status !== "candidate"}
                            onClick={() => approve.mutate(candidate.id)}
                          >
                            <Check className="mr-1 h-3 w-3" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={candidate.status !== "candidate"}
                            onClick={() =>
                              update.mutate({
                                id: candidate.id,
                                body: { status: "rejected" },
                              })
                            }
                          >
                            <X className="mr-1 h-3 w-3" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={candidate.status === "approved"}
                            onClick={() => beginEdit(candidate)}
                          >
                            <Pencil className="mr-1 h-3 w-3" /> Edit
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data.candidates.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No candidates yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
