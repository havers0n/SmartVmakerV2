import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  discoveryChannelFiltersSchema,
  getDiscoveryRun,
  listDiscoveryRunChannels,
} from "@/server/discovery-runs";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await getDiscoveryRun(params.id)))
      return NextResponse.json(
        { error: "Discovery run not found" },
        { status: 404 },
      );
    const search = new URL(request.url).searchParams;
    const filters = discoveryChannelFiltersSchema.parse({
      maxChannelAgeMonths: search.get("maxChannelAgeMonths") ?? undefined,
      minMatchedVideos: search.get("minMatchedVideos") ?? undefined,
      minSubscribers: search.get("minSubscribers") ?? undefined,
      maxSubscribers: search.get("maxSubscribers") ?? undefined,
      minMedianViews: search.get("minMedianViews") ?? undefined,
    });
    return NextResponse.json(
      await listDiscoveryRunChannels(params.id, filters),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid run id or channel filters" },
        { status: 400 },
      );
    console.error("Error loading discovery channels:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
