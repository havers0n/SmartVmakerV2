"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Video, Factory, Library, ArrowRight } from "lucide-react";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Video Generation Factory</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            AI-powered video creation platform with trend analysis, scenario generation, and production orchestration
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 hover-elevate cursor-pointer" onClick={() => router.push("/hwar/create")} data-testid="card-create">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Create</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate videos from prompts, presets, or YouTube trends. AI-powered scenario generation with first/last frame control and animation.
            </p>
            <Button variant="ghost" className="gap-2 px-0" data-testid="button-go-create">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </Card>

          <Card className="p-6 hover-elevate cursor-pointer" onClick={() => router.push("/hwar/factory")} data-testid="card-factory">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Factory className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Factory</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Production pipeline orchestration. Manage harvests, analysis queues, workers, batches, and track costs and analytics.
            </p>
            <Button variant="ghost" className="gap-2 px-0" data-testid="button-go-factory">
              Open Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </Card>

          <Card className="p-6 hover-elevate cursor-pointer" onClick={() => router.push("/hwar/library")} data-testid="card-library">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Library className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Library</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Manage presets, characters, datasets, and templates. Reusable assets for consistent video production.
            </p>
            <Button variant="ghost" className="gap-2 px-0" data-testid="button-go-library">
              Browse Library <ArrowRight className="w-4 h-4" />
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}