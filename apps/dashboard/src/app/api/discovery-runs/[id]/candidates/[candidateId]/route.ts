import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import {
  getDiscoveryRun,
  listDiscoveryClusterCurationVideos,
  setDiscoveryClusterCurationExcluded,
} from "@/server/discovery-runs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; candidateId: string } },
) {
  try {
    if (!(await getDiscoveryRun(params.id)))
      return NextResponse.json(
        { error: "Discovery run not found" },
        { status: 404 },
      );
    const videos = await listDiscoveryClusterCurationVideos(
      params.id,
      params.candidateId,
    );
    return videos
      ? NextResponse.json(videos)
      : NextResponse.json(
          { error: "Research candidate not found" },
          { status: 404 },
        );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    console.error("Error loading cluster curation videos:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

const curationSchema = z.object({
  videoIds: z.array(z.string().uuid()).min(1),
  isExcluded: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; candidateId: string } },
) {
  try {
    if (!(await getDiscoveryRun(params.id)))
      return NextResponse.json(
        { error: "Discovery run not found" },
        { status: 404 },
      );
    const { videoIds, isExcluded } = curationSchema.parse(await request.json());
    return NextResponse.json(
      await setDiscoveryClusterCurationExcluded(
        params.id,
        params.candidateId,
        videoIds,
        isExcluded,
      ),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid curation request" },
        { status: 400 },
      );
    console.error("Error saving cluster curation:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
