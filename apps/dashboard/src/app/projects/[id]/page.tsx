'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import {
    AlertCircle,
    Play,
    FileText,
    Image as ImageIcon,
    Video,
    RefreshCw,
    CheckCircle2
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { StatusBadge } from '@/shared/components/ui/status-badge';

// Types
interface PipelineStatus {
    projectId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    currentStage: string;
    stages: {
        analysis: {
            status: 'completed' | 'processing' | 'pending';
            details: string;
        };
        scripting: {
            status: 'completed' | 'processing' | 'pending';
            text: string | null;
        };
        visuals: {
            total: number;
            completed: number;
            failed: number;
            progress: number;
        };
        rendering: {
            total: number;
            completed: number;
            current_scene: number;
            progress: number;
        };
    };
    needsApproval: boolean;
}

async function fetchPipelineStatus(id: string): Promise<PipelineStatus> {
    const res = await fetch(`/api/projects/${id}/pipeline`);
    if (!res.ok) {
        throw new Error('Failed to fetch pipeline status');
    }
    return res.json();
}

export default function ProjectMissionControlPage() {
    const params = useParams();
    const id = params.id as string;

    const { data, error, isLoading, isRefetching } = useQuery({
        queryKey: ['project-pipeline', id],
        queryFn: () => fetchPipelineStatus(id),
        refetchInterval: 3000, // Poll every 3 seconds
    });

    if (isLoading) {
        return <MissionControlSkeleton />;
    }

    if (error) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Card className="w-full max-w-md border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Error Loading Project
                        </CardTitle>
                        <CardDescription>
                            {(error as Error).message || 'Something went wrong while fetching the project status.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => window.location.reload()}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="container mx-auto max-w-6xl space-y-8 p-6">
            {/* Header Section */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
                    <p className="text-muted-foreground">
                        Project ID: <span className="font-mono text-xs">{id}</span>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {isRefetching && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <StatusBadge status={data.status} />
                </div>
            </div>

            {/* Pipeline Stepper */}
            <PipelineStepper status={data} />

            {/* Main Stage View */}
            <div className="grid gap-6 md:grid-cols-12">
                <div className="md:col-span-12">
                    <StageContent status={data} />
                </div>
            </div>
        </div>
    );
}

function PipelineStepper({ status }: { status: PipelineStatus }) {
    const steps = [
        { key: 'analysis', label: 'Analysis', icon: FileText },
        { key: 'scripting', label: 'Scripting', icon: FileText },
        { key: 'visuals', label: 'Visuals', icon: ImageIcon },
        { key: 'rendering', label: 'Rendering', icon: Video },
    ];

    // Determine active step index
    let activeIndex = 0;
    if (status.stages.analysis.status === 'completed') activeIndex = 1;
    if (status.stages.scripting.status === 'completed') activeIndex = 2;
    if (status.stages.visuals.progress === 100 && status.stages.visuals.total > 0) activeIndex = 3;
    if (status.stages.rendering.progress === 100 && status.stages.rendering.total > 0) activeIndex = 4;

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="relative flex flex-col justify-between gap-4 md:flex-row">
                    {/* Connecting Lines (Desktop) */}
                    <div className="absolute left-0 top-1/2 hidden h-0.5 w-full -translate-y-1/2 bg-muted md:block" style={{ zIndex: 0 }} />

                    {steps.map((step, index) => {
                        const isCompleted = index < activeIndex;
                        const isCurrent = index === activeIndex;
                        const Icon = step.icon;

                        return (
                            <div key={step.key} className="relative z-10 flex flex-1 flex-col items-center gap-2 bg-background px-2 md:bg-transparent">
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${isCompleted
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : isCurrent
                                                ? 'border-primary bg-background text-primary'
                                                : 'border-muted bg-muted text-muted-foreground'
                                        }`}
                                >
                                    {isCompleted ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-5 w-5" />}
                                </div>
                                <span
                                    className={`text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'
                                        }`}
                                >
                                    {step.label}
                                </span>
                                {isCurrent && (
                                    <span className="absolute -bottom-6 w-max text-xs text-primary animate-pulse">
                                        Processing...
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

function StageContent({ status }: { status: PipelineStatus }) {
    // Logic to find active stage for display
    let activeStage = 'analysis';
    if (status.stages.analysis.status === 'completed') activeStage = 'scripting';
    if (status.stages.scripting.status === 'completed') activeStage = 'visuals';
    if (status.stages.visuals.progress === 100 && status.stages.visuals.total > 0) activeStage = 'rendering';
    if (status.stages.rendering.progress === 100 && status.stages.rendering.total > 0) activeStage = 'completed';

    if (activeStage === 'analysis') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Video Analysis</CardTitle>
                    <CardDescription>Analyzing content structure and extracting hooks.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 rounded-lg border p-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                            <Play className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-medium">Target Video</p>
                            <p className="text-sm text-muted-foreground">Processing video data...</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Analysis Status</span>
                            <span className="text-muted-foreground capitalize">{status.stages.analysis.status}</span>
                        </div>
                        <Progress value={status.stages.analysis.status === 'completed' ? 100 : 45} className="h-2" />
                    </div>

                    <div className="rounded-md bg-muted p-4">
                        <h4 className="mb-2 text-sm font-semibold">Extracted Metadata</h4>
                        <p className="text-sm text-muted-foreground font-mono">
                            {status.stages.analysis.details || "Waiting for data..."}
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (activeStage === 'scripting') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Script Generation</CardTitle>
                    <CardDescription>Drafting the narrative and hooks.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Status</span>
                            <span className="text-muted-foreground capitalize">{status.stages.scripting.status}</span>
                        </div>
                    </div>

                    <div className="rounded-md border p-4">
                        <ScrollArea className="h-[200px]">
                            <p className="whitespace-pre-wrap text-sm">
                                {status.stages.scripting.text || "Generating script..."}
                            </p>
                        </ScrollArea>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={() => console.log('Approve Script')}>Approve Script</Button>
                        <Button variant="outline" onClick={() => console.log('Edit Script')}>Edit</Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (activeStage === 'visuals') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Visuals Generation</CardTitle>
                    <CardDescription>Creating keyframes and assets.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span className="text-muted-foreground">
                                {status.stages.visuals.completed} / {status.stages.visuals.total} Images
                            </span>
                        </div>
                        <Progress value={status.stages.visuals.progress} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {Array.from({ length: Math.max(status.stages.visuals.total, 4) }).map((_, i) => (
                            <div key={i} className="aspect-video rounded-md bg-muted flex items-center justify-center overflow-hidden border">
                                {i < status.stages.visuals.completed ? (
                                    <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                                ) : (
                                    <div className="h-full w-full animate-pulse bg-muted/50" />
                                )}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (activeStage === 'rendering' || activeStage === 'completed') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Video Rendering</CardTitle>
                    <CardDescription>Compiling final video output.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Rendering Progress</span>
                            <span className="text-muted-foreground">
                                {status.stages.rendering.progress}%
                            </span>
                        </div>
                        <Progress value={status.stages.rendering.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                            Processing Scene {status.stages.rendering.current_scene} of {status.stages.rendering.total}
                        </p>
                    </div>

                    {activeStage === 'completed' && (
                        <div className="rounded-lg border bg-black aspect-video flex items-center justify-center">
                            <Play className="h-12 w-12 text-white" />
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    return null;
}

function MissionControlSkeleton() {
    return (
        <div className="container mx-auto max-w-6xl space-y-8 p-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
    )
}
