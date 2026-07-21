import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  bulkAttachVideosToContentFormat,
  bulkVideoAssociationSchema,
  ContentFormatConflictError,
} from "@/server/content-formats";

export async function POST(r: Request, { params }: { params: { id: string } }) {
  try {
    const parsed = bulkVideoAssociationSchema.parse(await r.json());
    return NextResponse.json(
      await bulkAttachVideosToContentFormat(params.id, parsed),
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof ZodError
            ? "Invalid bulk video association"
            : e instanceof ContentFormatConflictError
              ? e.message
              : "Internal Server Error",
      },
      {
        status:
          e instanceof ZodError
            ? 400
            : e instanceof ContentFormatConflictError
              ? e.message.includes("not found")
                ? 404
                : 409
              : 500,
      },
    );
  }
}
