import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { Plus, Video } from 'lucide-react';
import { db } from '@/shared/lib/db';
import { generationProjects, youtubeVideos } from '@scrimspec/db';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';

type ProjectStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface Project {
    id: string;
    status: ProjectStatus;
    stage: string;
    createdAt: Date | string;
    thumbnailUrl?: string | null;
}

// YouTube thumbnails type (from YouTube API)
type YoutubeThumbnails =
    | null
    | {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
    };

// Human-readable stage mapping
const STAGE_LABELS: Record<string, string> = {
    init: 'Initializing',
    ingest: 'Ingesting',
    analyze: 'Analyzing',
    scripting: 'Scripting',
    producing: 'Producing',
    completed: 'Completed',
};

// Standardized badge styling
const BADGE_STYLES = {
    completed: 'bg-emerald-500 text-white hover:bg-emerald-600 border-emerald-500',
} as const;

// Status badge variant mapping
function getStatusBadgeVariant(status: ProjectStatus): 'default' | 'outline' | 'destructive' | 'secondary' {
    switch (status) {
        case 'pending':
            return 'outline';
        case 'processing':
            return 'default';
        case 'failed':
            return 'destructive';
        case 'completed':
            return 'secondary'; // Will override with custom styling
        default:
            return 'outline';
    }
}

// Extract thumbnail URL from YouTube thumbnails JSON with proper typing
function extractThumbnailUrl(thumbnails: YoutubeThumbnails): string | null {
    if (!thumbnails || typeof thumbnails !== 'object') return null;

    // Priority: high -> medium -> default
    if (thumbnails.high?.url) return thumbnails.high.url;
    if (thumbnails.medium?.url) return thumbnails.medium.url;
    if (thumbnails.default?.url) return thumbnails.default.url;

    return null;
}

// Format date with locale support
function formatProjectDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Use user's locale for better internationalization
    return dateObj.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default async function ProjectsPage() {
    // Fetch 50 most recent projects with YouTube video data
    const projects = await db
        .select({
            id: generationProjects.id,
            status: generationProjects.status,
            stage: generationProjects.stage,
            createdAt: generationProjects.createdAt,
            youtubeVideoId: generationProjects.youtubeVideoId,
            thumbnails: youtubeVideos.thumbnails,
        })
        .from(generationProjects)
        .leftJoin(
            youtubeVideos,
            eq(generationProjects.youtubeVideoId, youtubeVideos.youtubeId)
        )
        .orderBy(desc(generationProjects.createdAt))
        .limit(50);

    // Transform data
    const projectsData: Project[] = projects.map((p) => ({
        id: p.id,
        status: p.status as ProjectStatus,
        stage: p.stage || 'init',
        createdAt: p.createdAt || new Date(),
        thumbnailUrl: extractThumbnailUrl(p.thumbnails as YoutubeThumbnails),
    }));

    return (
        <div className="container mx-auto px-6 py-4">
            {/* Header Section */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your video generation projects
                    </p>
                </div>
                <Link href="/hwar/create/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create New
                    </Button>
                </Link>
            </div>

            {/* Projects Grid or Empty State */}
            {projectsData.length === 0 ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                    <Video className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No projects found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Create your first one to get started.
                    </p>
                    <Link href="/hwar/create/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create New
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {projectsData.map((project) => (
                        <Link key={project.id} href={`/projects/${project.id}`}>
                            <Card className="overflow-hidden transition-shadow hover:shadow-lg cursor-pointer">
                                {/* Thumbnail */}
                                <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                                    {project.thumbnailUrl ? (
                                        <img
                                            src={project.thumbnailUrl}
                                            alt="Project thumbnail"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <Video className="h-12 w-12 text-muted-foreground/50" />
                                    )}
                                </div>

                                <CardContent className="p-4">
                                    {/* Project ID */}
                                    <div className="mb-3 flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-mono text-sm font-medium truncate">
                                                {project.id.substring(0, 8)}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {formatProjectDate(project.createdAt)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status and Stage */}
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={getStatusBadgeVariant(project.status)}
                                            className={
                                                project.status === 'completed'
                                                    ? BADGE_STYLES.completed
                                                    : ''
                                            }
                                        >
                                            {project.status}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {STAGE_LABELS[project.stage] || project.stage}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
