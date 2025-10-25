"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../../@/components/ui/button";
import { Card } from "../../@/components/ui/card";
import { Label } from "../../@/components/ui/label";
import { Input } from "../../@/components/ui/input";
import { Textarea } from "../../@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../@/components/ui/tabs";
import { Badge } from "../../@/components/ui/badge";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useToast } from "../../@/hooks/use-toast";
import { cn } from "../../@/lib/utils";
import { makeClient } from "@project/api-client";

// Mock data for now
const ratios = ["16:9", "9:16", "4:3", "3:4"] as const;
const languages = [
  { value: "none", label: "No audio track" },
  { value: "ru", label: "Russian" },
  { value: "en", label: "English" },
  { value: "he", label: "Hebrew" },
  { value: "es", label: "Spanish" },
];

const api = makeClient();

export default function NewProject() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [ratio, setRatio] = useState<typeof ratios[number]>("16:9");
  const [lang, setLang] = useState("none");
  const [source, setSource] = useState<"prompt" | "preset" | "trends">("prompt");
  const [prompt, setPrompt] = useState("");

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const project = await api.hwar.createProject({
        title: title || "Untitled Project",
        ratio,
        lang,
        source,
        prompt: source === "prompt" ? prompt : undefined,
      });
      
      // If there's a prompt, immediately generate scenarios
      if (source === "prompt" && prompt) {
        await api.hwar.generateScenarios(project.id, { prompt });
      } else if (source === "trends" || source === "preset") {
        // Generate scenarios for preset/trends
        await api.hwar.generateScenarios(project.id, {});
      }
      
      return project;
    },
    onSuccess: (project: any) => {
      router.push(`/hwar/create/${project.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      createProjectMutation.mutate();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.push("/hwar/create");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Progress indicator */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 font-medium text-sm",
                  s <= step
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground"
                )}
              >
                {s}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "flex-1 h-2 rounded-full",
                  s <= step ? "bg-primary" : "bg-border"
                )}
              />
            ))}
          </div>
        </div>

        <Card className="p-8 border rounded-xl">
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-semibold mb-2">Project Details</h2>
              <p className="text-sm text-muted-foreground mb-8">Configure your video project</p>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="title" className="text-sm font-medium mb-2 block">Project Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Motivational Story"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid="input-title"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-3 block">Aspect Ratio</Label>
                  <div className="inline-flex gap-2">
                    {ratios.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRatio(r)}
                        className={cn(
                          "px-4 py-2 rounded-full border text-sm font-medium transition-colors",
                          ratio === r
                            ? "border-primary bg-primary text-primary-foreground font-semibold"
                            : "border-border bg-background hover:bg-accent"
                        )}
                        data-testid={`button-ratio-${r}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Recommended duration: {ratio === "9:16" ? "16-30s (Stories)" : "40-70s (Landscape)"}
                  </p>
                </div>

                <div>
                  <Label htmlFor="language" className="text-sm font-medium mb-2 block">Language</Label>
                  <Select value={lang} onValueChange={setLang}>
                    <SelectTrigger className="h-10" id="language" data-testid="select-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ratio preview */}
                <div className="flex justify-center">
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    <div
                      className="bg-muted rounded flex items-center justify-center"
                      style={{
                        width: ratio === "16:9" ? "240px" : ratio === "9:16" ? "135px" : ratio === "4:3" ? "200px" : "150px",
                        height: ratio === "16:9" ? "135px" : ratio === "9:16" ? "240px" : ratio === "4:3" ? "150px" : "200px",
                      }}
                    >
                      <span className="text-sm font-mono text-muted-foreground">{ratio}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-semibold mb-2">Content Source</h2>
              <p className="text-sm text-muted-foreground mb-8">How would you like to generate your video?</p>

              <Tabs value={source} onValueChange={(v) => setSource(v as "prompt" | "preset" | "trends")}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="prompt" data-testid="tab-prompt">Prompt</TabsTrigger>
                  <TabsTrigger value="preset" data-testid="tab-presets">Presets</TabsTrigger>
                  <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
                </TabsList>

                <TabsContent value="prompt" className="mt-6">
                  <Label htmlFor="prompt" className="text-sm font-medium mb-2 block">Describe your video</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Example: A dramatic story about a person overcoming challenges. Start with a close-up of emotion, build tension through quick cuts, and end with a triumphant payoff..."
                    className="min-h-32 resize-none"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    data-testid="input-prompt"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Tip: Include AES structure (Attention → Emotion → Solution), emotional arc, and pacing details
                  </p>
                </TabsContent>

                <TabsContent value="preset" className="mt-6">
                  <div className="grid grid-cols-2 gap-4">
                    {["Epic Journey", "Quick Win", "Transformation", "Tutorial"].map((preset) => (
                      <Card key={preset} className="p-4 hover-elevate cursor-pointer" data-testid={`card-preset-${preset.toLowerCase().replace(/\s+/g, '-')}`}>
                        <h4 className="font-medium mb-1">{preset}</h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          Pre-configured story template
                        </p>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">Drama</Badge>
                          <Badge variant="secondary" className="text-xs">Inspiring</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="trends" className="mt-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate scenarios based on successful YouTube video patterns
                  </p>
                  <Card className="p-4 border-l-4 border-l-primary">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium mb-1">Latest Trends Available</p>
                        <p className="text-xs text-muted-foreground">
                          Using insights from 247 analyzed videos: Hook ≤ 2s, Payoff @ 17s median, emphasis on close-up emotions
                        </p>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-semibold mb-2">Review & Generate</h2>
              <p className="text-sm text-muted-foreground mb-8">Confirm your settings before generating scenarios</p>

              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b">
                  <span className="text-sm text-muted-foreground">Aspect Ratio</span>
                  <span className="text-sm font-medium">{ratio}</span>
                </div>
                <div className="flex justify-between py-3 border-b">
                  <span className="text-sm text-muted-foreground">Language</span>
                  <span className="text-sm font-medium capitalize">
                    {languages.find((l) => l.value === lang)?.label}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b">
                  <span className="text-sm text-muted-foreground">Source</span>
                  <span className="text-sm font-medium capitalize">{source}</span>
                </div>
                {source === "prompt" && prompt && (
                  <div className="py-3">
                    <span className="text-sm text-muted-foreground block mb-2">Prompt</span>
                    <p className="text-sm bg-muted p-3 rounded-lg">{prompt}</p>
                  </div>
                )}
              </div>

              <Card className="p-4 bg-primary/5 border-primary/20 mt-6">
                <p className="text-sm">
                  <span className="font-medium">Next step:</span> AI will generate 5 scenario concepts with scoring. You can pick one or mix scenes from multiple concepts.
                </p>
              </Card>
            </div>
          )}
        </Card>

        <div className="mt-8 flex justify-between">
          <Button variant="outline" onClick={handleBack} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <Button
            onClick={handleNext}
            disabled={(step === 2 && source === "prompt" && !prompt) || createProjectMutation.isPending}
            data-testid="button-next"
          >
            {createProjectMutation.isPending ? (
              "Creating..."
            ) : step === 3 ? (
              "Create Project"
            ) : (
              "Continue"
            )}
            {!createProjectMutation.isPending && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}