"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/hooks/use-toast";
import { callAction } from "@/shared/api/actions";
import { useRouter } from "next/navigation";

export function StartAnalysisButton({ videoId }: { videoId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const start = async () => {
    setSubmitting(true);
    try {
      await callAction("analysis.startAnalysis", {
        videoIds: [videoId],
        analyzer: "gemini",
      });
      toast({
        title: "Analysis started",
        description: "Job dispatched to analysis queue.",
      });
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start analysis";
      toast({
        title: "Failed to start analysis",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button onClick={start} disabled={submitting}>
      {submitting ? "Starting..." : "Start analysis"}
    </Button>
  );
}


