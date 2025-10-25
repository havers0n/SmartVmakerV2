"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { Badge } from "@/src/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/src/components/ui/dialog";
import { EmptyState } from "@/src/components/ui/empty-state";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { useToast } from "@/src/hooks/use-toast";
import { Download, Plus, Play, Pause } from "lucide-react";
import { client } from "@project/api-client";

const harvestFormSchema = z.object({
  query: z.string().min(3, "Query must be at least 3 characters").max(200, "Query must be less than 200 characters"),
  lang: z.string(),
  limit: z.coerce.number().min(1, "Limit must be at least 1").max(100, "Limit must be at most 100"),
});

type Harvest = {
  id: string;
  query: string;
  lang?: string;
  status: string;
  createdAt: string;
  stats?: {
    found?: number;
    unique?: number;
    filtered_out?: Record<string, number>;
    queued?: number;
    analyzed?: number;
    failed?: number;
    errors?: number;
  };
};

type HarvestFormValues = z.infer<typeof harvestFormSchema>;

export default function Harvests() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const { toast } = useToast();

  const form = useForm<HarvestFormValues>({
    resolver: zodResolver(harvestFormSchema),
    defaultValues: {
      query: "",
      lang: "en",
      limit: 30,
    },
  });

  const { data: harvests = [], isLoading, error, refetch } = useQuery<Harvest[]>({
    queryKey: ["harvests"],
    queryFn: () => client.hwar.listHarvests(),
  });

  const createHarvestMutation = useMutation({
    mutationFn: async (data: HarvestFormValues) => {
      return client.hwar.createHarvest(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["harvests"] });
      setShowNewDialog(false);
      form.reset();
      toast({
        title: "Harvest created",
        description: "YouTube search harvest has been queued",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateHarvest = (values: HarvestFormValues) => {
    createHarvestMutation.mutate(values);
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2">YouTube Harvests</h1>
          <p className="text-sm text-muted-foreground">Search and analyze YouTube videos for trend insights</p>
        </div>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-harvest">
              <Plus className="w-4 h-4 mr-2" />
              New Harvest
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl" aria-describedby="harvest-dialog-description">
            <DialogHeader>
              <DialogTitle>Create YouTube Harvest</DialogTitle>
              <p id="harvest-dialog-description" className="sr-only">Configure YouTube search parameters to harvest videos for analysis</p>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateHarvest)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Search Query</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., motivational shorts 2024"
                          data-testid="input-query"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lang"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-language">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="ru">Russian</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="limit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Limit</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            data-testid="input-limit"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border rounded-lg p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-3">Filters</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Duration:</span> 15-70s
                    </div>
                    <div>
                      <span className="text-muted-foreground">Min Views:</span> 10,000
                    </div>
                    <div>
                      <span className="text-muted-foreground">Captions:</span> Required
                    </div>
                    <div>
                      <span className="text-muted-foreground">Exclude:</span> NSFW, Gore
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewDialog(false);
                      form.reset();
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createHarvestMutation.isPending}
                    data-testid="button-run-harvest"
                  >
                    {createHarvestMutation.isPending ? (
                      <>Creating...</>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Run Harvest
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {error ? (
        <Card className="p-8">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Failed to load harvests</h3>
            <p className="text-sm text-muted-foreground mb-4">{error instanceof Error ? error.message : "An error occurred"}</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
              <div className="h-20 bg-muted rounded"></div>
            </Card>
          ))}
        </div>
      ) : harvests.length === 0 ? (
        <EmptyState
          icon={Download}
          title="No harvests yet"
          description="Create a harvest to search YouTube videos, analyze their structure, and extract insights for better video generation"
          action={{
            label: "Create Harvest",
            onClick: () => setShowNewDialog(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {harvests.map((harvest) => {
            const stats = harvest.stats || { found: 0, unique: 0, filtered_out: {}, queued: 0, analyzed: 0, failed: 0, errors: 0 };
            
            return (
              <Card key={harvest.id} className="p-6 hover-elevate cursor-pointer" onClick={() => router.push(`/hwar/factory/harvests/${harvest.id}`)}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold mb-1">{harvest.query}</h3>
                    <div className="inline-flex gap-2 flex-wrap">
                      {harvest.lang && <Badge variant="secondary" className="text-xs">{harvest.lang}</Badge>}
                      <span className="text-xs text-muted-foreground">{new Date(harvest.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <StatusBadge status={harvest.status} />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <div className="text-2xl font-bold tabular-nums">{stats.found || 0}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Found</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums">{stats.queued || 0}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Queued</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums">{stats.analyzed || 0}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Analyzed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums">{stats.failed || 0}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Failed</div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t flex gap-3">
                  <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </Button>
                  <Button size="sm" variant="outline">View Details</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}