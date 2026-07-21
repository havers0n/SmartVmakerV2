import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getDiscoveryRun,
  listDiscoveryRunVideos,
} from "@/server/discovery-runs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await getDiscoveryRun(params.id)))
      return NextResponse.json(
        { error: "Discovery run not found" },
        { status: 404 },
      );
    return NextResponse.json(await listDiscoveryRunVideos(params.id));
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
    console.error("Error loading discovery videos:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
