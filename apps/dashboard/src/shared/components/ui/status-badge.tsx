import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/components/ui/badge";

type StatusBadgeProps = {
  status: string;
  className?: string;
};

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  // Project statuses
  draft: { variant: "secondary", color: "text-muted-foreground" },
  scenarios_generating: { variant: "default", color: "text-primary" },
  scenarios_review: { variant: "outline", color: "text-foreground" },
  frames_generating: { variant: "default", color: "text-primary" },
  animation_generating: { variant: "default", color: "text-primary" },
  done: { variant: "default", color: "text-green-600" },
  failed: { variant: "destructive", color: "text-destructive" },
  
  // Job statuses
  pending: { variant: "secondary", color: "text-muted-foreground" },
  processing: { variant: "default", color: "text-primary" },
  
  // Video statuses
  new: { variant: "secondary", color: "text-muted-foreground" },
  filtered: { variant: "outline", color: "text-muted-foreground" },
  ready: { variant: "default", color: "text-green-600" },
  analyzed: { variant: "default", color: "text-green-600" },
  
  // Harvest statuses
  running: { variant: "default", color: "text-primary" },
  completed: { variant: "default", color: "text-green-600" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const displayText = status.replace(/_/g, " ");
  
  return (
    <Badge variant={config.variant} className={cn("h-6 px-2.5 rounded-full text-xs font-medium capitalize", className)}>
      <div className={cn("w-1.5 h-1.5 rounded-full mr-1.5", config.color.replace("text-", "bg-"))} />
      {displayText}
    </Badge>
  );
}
