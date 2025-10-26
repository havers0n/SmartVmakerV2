/**
 * HTTP Response Helpers
 * Consistent error mapping and typed responses for API routes
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiError = {
  message: string;
  code?: string;
  details?: unknown;
  stack?: string;
};

export const badRequest = (error: unknown) =>
  NextResponse.json({ ok: false, error: normalize(error) }, { status: 400 });

export const serverError = (error: unknown) =>
  NextResponse.json({ ok: false, error: normalize(error) }, { status: 500 });

export const unauthorized = (message = "Unauthorized") =>
  NextResponse.json(
    { ok: false, error: { message, code: "UNAUTHORIZED" } },
    { status: 401 }
  );

export const forbidden = (message = "Forbidden") =>
  NextResponse.json(
    { ok: false, error: { message, code: "FORBIDDEN" } },
    { status: 403 }
  );

export const notFound = (message = "Resource not found") =>
  NextResponse.json(
    { ok: false, error: { message, code: "NOT_FOUND" } },
    { status: 404 }
  );

function normalize(e: unknown): ApiError {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Zod validation errors
  if (e instanceof ZodError) {
    return {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: e.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    };
  }

  // PostgreSQL errors (from pg library)
  if (e && typeof e === 'object' && 'code' in e && 'severity' in e) {
    const pgError = e as unknown as { code: string; message: string; detail?: string; table?: string };
    return {
      message: pgError.message || 'Database error',
      code: `PG_${pgError.code}`,
      details: isDevelopment
        ? { detail: pgError.detail, table: pgError.table }
        : undefined,
    };
  }

  // Standard JavaScript errors
  if (e instanceof Error) {
    return {
      message: e.message,
      code: e.name.toUpperCase().replace(/ERROR$/i, ''),
      stack: isDevelopment ? e.stack : undefined,
    };
  }

  // Unknown errors
  return {
    message: String(e),
    code: 'UNKNOWN_ERROR',
  };
}
