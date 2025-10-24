/**
 * HTTP Response Helpers
 * Consistent error mapping and typed responses for API routes
 */

import { NextResponse } from "next/server";

export const badRequest = (error: unknown) =>
  NextResponse.json({ ok: false, error: normalize(error) }, { status: 400 });

export const serverError = (error: unknown) =>
  NextResponse.json({ ok: false, error: normalize(error) }, { status: 500 });

function normalize(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { message: msg };
}
