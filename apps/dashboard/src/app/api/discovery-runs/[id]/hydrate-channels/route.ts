import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getDiscoveryRun,
  hydrateDiscoveryRunChannels,
} from "@/server/discovery-runs";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await getDiscoveryRun(params.id)))
      return NextResponse.json(
        { error: "Discovery run not found" },
        { status: 404 },
      );

    const body = await _request.json().catch(() => ({}));
    const force = body?.force === true;

    const result = await hydrateDiscoveryRunChannels(params.id, { force });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
    console.error("Error hydrating channels:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
