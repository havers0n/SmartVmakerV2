import { NextResponse } from "next/server";
import { cancelDiscoveryRun } from "@/server/discovery-runs";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const run = await cancelDiscoveryRun(params.id);
    return run ? NextResponse.json(run) : NextResponse.json({ error: "Run not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
  }
}
